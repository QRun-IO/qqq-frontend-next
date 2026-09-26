/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.Set;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.frontend.materialdashboard.actions.formadjuster.FormAdjusterInput;
import com.kingsrook.qqq.frontend.materialdashboard.actions.formadjuster.FormAdjusterInterface;
import com.kingsrook.qqq.frontend.materialdashboard.actions.formadjuster.FormAdjusterOutput;
import com.kingsrook.qqq.frontend.materialdashboard.actions.formadjuster.FormAdjusterOutputBuilder;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.MaterialDashboardFieldMetaData;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.MaterialDashboardTableMetaData;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.fieldrules.FieldRule;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.fieldrules.FieldRuleAction;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.fieldrules.FieldRuleTrigger;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** A dedicated real-server form-adjuster fixture. Existing record tables stay
 ** unchanged, so their acceptance cases cannot be affected by adjuster output.
 *******************************************************************************/
final class FormAdjusterFixtures
{
   static final String TABLE_NAME = "adjusterLab";



   private FormAdjusterFixtures()
   {
   }



   static void define(QInstance instance) throws QException
   {
      QFieldMetaData name = new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true).withMaxLength(80);
      name.withSupplementalMetaData(new MaterialDashboardFieldMetaData()
         .withFormAdjusterIdentifier("table:" + TABLE_NAME + ";field:name")
         .withOnChangeFormAdjuster(new QCodeReference(NameAdjuster.class))
         .withFieldsToDisableWhileRunningAdjusters(Set.of("note")));

      QTableMetaData table = new QTableMetaData()
         .withName(TABLE_NAME)
         .withLabel("Adjuster Lab")
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withPrimaryKeyField("id")
         .withRecordLabelFormat("%s")
         .withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(name)
         .withField(new QFieldMetaData("note", QFieldType.STRING).withMaxLength(100))
         .withField(new QFieldMetaData("status", QFieldType.STRING).withMaxLength(30))
         .withSection(new QFieldSection("main", new QIcon("tune"), Tier.T1, List.of("id", "name", "note", "status")));
      MaterialDashboardTableMetaData.ofOrWithNew(table)
         .withOnLoadFormAdjuster(new QCodeReference(TableAdjuster.class))
         .withFieldRule(new FieldRule().withTrigger(FieldRuleTrigger.ON_CHANGE).withSourceField("name")
            .withAction(FieldRuleAction.CLEAR_TARGET_FIELD).withTargetField("status"));
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
      QInstanceEnricher.setInferredFieldBackendNames(table);
      instance.addTable(table);
      instance.getApp(RecordsFixtures.APP_NAME).withChild(table);
   }



   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS adjuster_lab");
         statement.execute("CREATE TABLE adjuster_lab (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, note VARCHAR(100), status VARCHAR(30))");
      }
   }



   public static class TableAdjuster implements FormAdjusterInterface
   {
      @Override
      public FormAdjusterOutput execute(FormAdjusterInput input)
      {
         if("Locked".equals(input.getFieldValue("name")))
         {
            return new FormAdjusterOutput().withIsFormDisabled(true).withFormDisabledMessage("Locked by the server");
         }
         return new FormAdjusterOutput().withUpdatedFieldValues(Map.of("note", "Loaded by table adjuster"));
      }
   }



   public static class NameAdjuster implements FormAdjusterInterface
   {
      @Override
      public FormAdjusterOutput execute(FormAdjusterInput input) throws QException
      {
         String value = String.valueOf(input.getNewValue());
         FormAdjusterOutputBuilder builder = new FormAdjusterOutputBuilder(TABLE_NAME);
         builder.makeFieldLabel("note", value.contains("label") ? "Adjusted note" : "Note");
         FormAdjusterOutput output = builder.build();
         if(value.contains("clear"))
         {
            output.withFieldsToClear(Set.of("note"));
         }
         return output;
      }
   }
}
