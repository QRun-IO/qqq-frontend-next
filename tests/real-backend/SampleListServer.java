/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.concurrent.atomic.AtomicReference;
import java.util.List;
import java.util.Map;
import com.kingsrook.sampleapp.SampleJavalinServer;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ChildRecordListRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.RowBuilderWidgetRenderer;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.fields.FieldAdornment;
import com.kingsrook.qqq.backend.core.model.metadata.fields.AdornmentType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinOn;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.QJoinMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Association;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.core.model.session.QSession;
import com.kingsrook.qqq.backend.core.modules.authentication.QAuthenticationModuleCustomizerInterface;
import com.kingsrook.qqq.backend.module.rdbms.jdbc.ConnectionManager;
import io.javalin.Javalin;
import org.json.JSONArray;
import org.json.JSONObject;

/** Runs the packaged, synthetic sample on an owned loopback-only ephemeral port. */
public class SampleListServer
{
   public static void main(String[] args) throws Exception
   {
      System.setProperty("qqq.sample.mockAuthentication", "true");
      SampleJavalinServer server = new SampleJavalinServer(new SampleMetaDataProvider()
      {
         @Override
         public QInstance defineQInstance() throws QException
         {
            QInstance instance = super.defineQInstance();
            if(args.length > 0 && "write".equals(args[0]))
            {
               // Navigation acceptance owns no external QuickSight account.
               instance.getApp("greetingsApp").setWidgets(instance.getApp("greetingsApp").getWidgets().stream()
                  .filter(name -> !"QuickSightChartRenderer".equals(name)).toList());
            }
            if(args.length > 0 && args[0].startsWith("copy-"))
            {
               for(String table : List.of("person", "pet", "petNote"))
               {
                  instance.getTable(table).setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               }
               instance.getAuthentication().setCustomizer(new QCodeReference("copy-denied".equals(args[0]) ? CopyWithoutNoteReads.class : CopyPermissions.class));
               instance.getTable("petNote")
                  .withField(new QFieldMetaData("payload", QFieldType.BLOB).withIsHeavy(true)
                     .withFieldAdornment(new FieldAdornment().withType(AdornmentType.FILE_DOWNLOAD).withValue("fileNameField", "fileName")))
                  .withField(new QFieldMetaData("fileName", QFieldType.STRING).withBackendName("file_name").withIsEditable(false))
                  .withField(new QFieldMetaData("flag", QFieldType.BOOLEAN))
                  .withSection(new QFieldSection().withName("file").withLabel("File").withTier(Tier.T2).withFieldNames(List.of("payload", "fileName", "flag")));
               if("copy-named".equals(args[0]))
               {
                  instance.getTable("person").withAssociation(new Association().withName("care group / primary")
                     .withAssociatedTableName("pet").withJoinName("personJoinPet"));
               }
            }
            else if(args.length > 0 && args[0].startsWith("association-"))
            {
               instance.getTable("person").setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               instance.getTable("pet").setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               instance.getAuthentication().setCustomizer(new QCodeReference("association-denied".equals(args[0]) ? PersonReadsPetWrites.class : PersonAndPetReads.class));
               if("association-named".equals(args[0]))
               {
                  defineNamedAssociations(instance);
               }
            }
            else if(args.length > 0 && "write".equals(args[0]))
            {
               instance.getTable("person").setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               instance.getTable("pet").setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               instance.getAuthentication().setCustomizer(new QCodeReference(PersonWritesNoPetReads.class));
            }
            else if(args.length > 0)
            {
               // T1 reference fields use the preview card even when other sections render a LINK adornment.
               instance.getTable("pet").getSections().stream().filter(section -> "identity".equals(section.getName())).findFirst().orElseThrow()
                  .setFieldNames(List.of("id", "name", "personId"));
               instance.getTable("pet").getSections().stream().filter(section -> "basicInfo".equals(section.getName())).findFirst().orElseThrow()
                  .setFieldNames(List.of("speciesId", "birthDate"));
               instance.getTable("person").setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               instance.getTable("pet").setPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_WRITE_PERMISSIONS));
               instance.getAuthentication().setCustomizer(new QCodeReference("detail-denied".equals(args[0]) ? PersonReadsPetWrites.class : PersonAndPetReads.class));
            }
            return instance;
         }
      });
      server.setPort(0);
      AtomicReference<Javalin> service = new AtomicReference<>();
      server.withJavalinConfigurationCustomizer(service::set);
      server.withJavalinConfigCustomizer(config ->
      {
         config.jetty.host = "127.0.0.1";
         if(args.length > 0 && ("write".equals(args[0]) || args[0].startsWith("association-") || args[0].startsWith("copy-")))
         {
            config.routes.get("/acceptance/write-state", context -> context.contentType("application/json").result(writeState().toString()));
         }
      });
      Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
      server.start();
      if(args.length > 0 && args[0].startsWith("copy-"))
      {
         try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend()))
         {
            if(!"jdbc:h2:mem:test_database".equals(connection.getMetaData().getURL()))
            {
               throw new IllegalStateException("Copy fixture requires owned in-memory H2.");
            }
            for(String definition : List.of("payload BLOB", "file_name VARCHAR(80)", "flag BOOLEAN"))
            {
               try(PreparedStatement statement = connection.prepareStatement("ALTER TABLE pet_note ADD " + definition))
               {
                  statement.executeUpdate();
               }
            }
            try(PreparedStatement statement = connection.prepareStatement("UPDATE pet_note SET payload = ?, file_name = ?, flag = FALSE WHERE id = 1"))
            {
               statement.setBytes(1, new byte[] { 0, 1, -1, -128, 65, 0 });
               statement.setString(2, "sample.bin");
               if(statement.executeUpdate() != 1)
               {
                  throw new IllegalStateException("Missing synthetic note fixture.");
               }
            }
         }
      }
      if(args.length > 0 && "association-named".equals(args[0]))
      {
         try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend()))
         {
            if(!"jdbc:h2:mem:test_database".equals(connection.getMetaData().getURL()))
            {
               throw new IllegalStateException("Named association fixture requires owned in-memory H2.");
            }
            try(PreparedStatement statement = connection.prepareStatement("UPDATE person SET days_worked = 2 WHERE id = 1"))
            {
               if(statement.executeUpdate() != 1)
               {
                  throw new IllegalStateException("Missing synthetic parent fixture.");
               }
            }
         }
      }
      System.out.println("QQQ_ACCEPTANCE_PORT=" + service.get().port());
   }

   /** Reuses sample fields to prove explicit aliases and a composite, non-primary join. */
   private static void defineNamedAssociations(QInstance instance)
   {
      instance.getTable("person").withAssociation(new Association().withName("care group / primary")
         .withAssociatedTableName("pet").withJoinName("personJoinPet"));
      QJoinMetaData composite = new QJoinMetaData().withName("scheduledCompanions")
         .withLeftTable("person").withRightTable("pet").withType(JoinType.ONE_TO_MANY)
         .withJoinOn(new JoinOn("daysWorked", "personId")).withJoinOn(new JoinOn("birthDate", "birthDate"));
      instance.addJoin(composite);
      instance.getTable("person").withAssociation(new Association().withName("scheduled reviews")
         .withAssociatedTableName("pet").withJoinName(composite.getName()));
      instance.getTable("pet").getField("personId").setPossibleValueSourceName(null);
      instance.addWidget(ChildRecordListRenderer.widgetMetaDataBuilder(instance.getJoin("personJoinPet"))
         .withName("companionPanel").withManageAssociationName("care group / primary").getWidgetMetaData());
      instance.addWidget(RowBuilderWidgetRenderer.widgetMetaDataBuilder("reviewEditor")
         .withAssociationName("scheduled reviews").withParentTableName("person")
         .withIsForRecordViewAndEditScreen(true).withFields(List.of(instance.getTable("pet").getField("name"))).getWidgetMetaData());
      instance.getTable("person").withSection(new QFieldSection().withName("fieldGuide").withLabel("Companions")
         .withTier(Tier.T2).withWidgetName("companionPanel"));
      instance.getTable("person").withSection(new QFieldSection().withName("reviewSchedule").withLabel("Review Schedule")
         .withTier(Tier.T2).withWidgetName("reviewEditor"));
   }

   private static JSONObject writeState() throws Exception
   {
      JSONObject snapshot = new JSONObject();
      try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend()))
      {
         if(!"jdbc:h2:mem:test_database".equals(connection.getMetaData().getURL()))
         {
            throw new IllegalStateException("Acceptance snapshot requires the sample in-memory H2 database.");
         }
         for(String table : List.of("person", "pet", "pet_note"))
         {
            JSONArray records = new JSONArray();
            try(PreparedStatement statement = connection.prepareStatement("SELECT * FROM " + table + " ORDER BY id");
                ResultSet rows = statement.executeQuery())
            {
               while(rows.next())
               {
                  JSONObject record = new JSONObject();
                  for(int column = 1; column <= rows.getMetaData().getColumnCount(); column++)
                  {
                     String value = rows.getMetaData().getColumnType(column) == java.sql.Types.BLOB
                        ? (rows.getBytes(column) == null ? null : java.util.Base64.getEncoder().encodeToString(rows.getBytes(column))) : rows.getString(column);
                     record.put(rows.getMetaData().getColumnLabel(column).toLowerCase(java.util.Locale.ROOT), value == null ? JSONObject.NULL : value);
                  }
                  records.put(record);
               }
            }
            snapshot.put(table, records);
         }
      }
      return snapshot;
   }

   public static class PersonWritesNoPetReads implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance instance, QSession session, Map<String, Object> context)
      {
         session.withPermissions("person.read", "person.write", "pet.write");
      }
   }

   public static class CopyPermissions implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance instance, QSession session, Map<String, Object> context)
      {
         session.withPermissions("person.read", "person.write", "pet.read", "pet.write", "petNote.read", "petNote.write");
      }
   }

   public static class CopyWithoutNoteReads implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance instance, QSession session, Map<String, Object> context)
      {
         session.withPermissions("person.read", "person.write", "pet.read", "pet.write", "petNote.write");
      }
   }

   public static class PersonReadsPetWrites implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance instance, QSession session, Map<String, Object> context)
      {
         session.withPermissions("person.read", "pet.write");
      }
   }

   public static class PersonAndPetReads implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance instance, QSession session, Map<String, Object> context)
      {
         session.withPermissions("person.read", "pet.read", "pet.write");
      }
   }
}
