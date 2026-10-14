/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.helpcontent.HelpContentMetaDataProvider;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpContent;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpRole;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QComponentType;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendComponentMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QProcessMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;

/** Synthetic help targets owned by the help acceptance area. */
final class HelpFixtures
{
   private HelpFixtures()
   {
   }

   /** Defines isolated metadata and the standard core authoring table. */
   static void define(QInstance instance) throws QException
   {
      if(instance.getTable("helpContent") == null)
      {
         new HelpContentMetaDataProvider().defineAll(instance, SampleMetaDataProvider.RDBMS_BACKEND_NAME, HelpFixtures::backend);
      }
      QTableMetaData table = new QTableMetaData().withName("helpTopic").withLabel("Help Topic")
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME).withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withLabel("Topic Name").withMaxLength(100)
            .withHelpContent(help("Name summary.", "Use a **recognizable name** for this topic.")))
         .withField(new QFieldMetaData("notes", QFieldType.STRING).withMaxLength(250))
         .withSection(new QFieldSection("identity", new QIcon("info"), Tier.T1, List.of("id", "name")))
         .withSection(new QFieldSection("details", new QIcon("info"), Tier.T2, List.of("notes"))
            .withHelpContent(help("Details summary.", "Keep **supporting details** here.")))
         .withHelpContent("help", help("Topic summary.", "Read the **complete topic guide** before editing."));
      backend(table);
      instance.addTable(table);

      instance.addProcess(new QProcessMetaData().withName("helpGuide").withLabel("Help Guide").withTableName("helpTopic").withMinInputRecords(0).withMaxInputRecords(1)
         .withHelpContent("help", help("Guide summary.", "Follow the **guided instructions**.").withRole(QHelpRole.PROCESS_SCREEN))
         .withHelpContent("help", help("Action summary.", "Open the **topic action guide**.").withRole(QHelpRole.TABLE_ACTION_MENU))
         .withStep(new QFrontendStepMetaData().withName("review").withLabel("Review Topic")
            .withHelpContent(help("Step summary.", "Review **each detail** before continuing."))
            .withComponent(new QFrontendComponentMetaData().withType(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("note", QFieldType.STRING).withLabel("Review Note"))));

      instance.addWidget(new QWidgetMetaData().withName("helpOverview").withLabel("Help Overview").withType("html")
         .withCodeReference(new QCodeReference(RecordsFixtures.SummaryWidgetRenderer.class))
         .withHelpContent("label", help("Overview summary.", "This widget explains the **help overview**.")));
      instance.addApp(new QAppMetaData().withName("helpLab").withLabel("Help Lab")
         .withChild(table).withChild(instance.getProcess("helpGuide")).withWidgets(List.of("helpOverview"))
         .withHelpContent("help", help("Application summary.", "Welcome to the **complete help laboratory**.").withRole(QHelpRole.APP_SCREEN)));
      instance.getReport(NavigationFixtures.REPORT_DEEP)
         .withHelpContent("help", help("Report summary.", "Choose the **report output format**."));
   }

   /** Builds real server-rendered Markdown with a distinct tooltip summary. */
   private static QHelpContent help(String summary, String body)
   {
      return new QHelpContent().withContentAsMarkdown(body).withSummary(summary);
   }

   /** Uses the same inferred SQL names as the other owned fixtures. */
   private static void backend(QTableMetaData table)
   {
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
      QInstanceEnricher.setInferredFieldBackendNames(table);
      // explicit per-subtype rules, so personas without *.insert cannot author help
      table.setPermissionRules(new QPermissionRules().withLevel(PermissionLevel.READ_INSERT_EDIT_DELETE_PERMISSIONS));
   }

   /** Resets only owned synthetic data; code-declared help survives each reset. */
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS help_topic");
         statement.execute("CREATE TABLE help_topic (id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, name VARCHAR(100), notes VARCHAR(250))");
         statement.execute("INSERT INTO help_topic (id, name, notes) VALUES (1, 'Owned Topic', 'Owned details')");
         statement.execute("DROP TABLE IF EXISTS help_content");
         statement.execute("CREATE TABLE help_content (id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, \"KEY\" VARCHAR(250), summary VARCHAR(500), content CLOB, format VARCHAR(30), role VARCHAR(50), permission_name VARCHAR(250), client_channel VARCHAR(100), create_date TIMESTAMP, modify_date TIMESTAMP)");
      }
   }
}
