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

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import com.kingsrook.qqq.backend.core.actions.customizers.TableCustomizerInterface;
import com.kingsrook.qqq.backend.core.actions.customizers.TableCustomizers;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.actions.tables.QueryOrGetInputInterface;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.audits.AuditsMetaDataProvider;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.RawHTML;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.data.QRecord;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.audits.AuditLevel;
import com.kingsrook.qqq.backend.core.model.metadata.audits.QAuditRules;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.AdornmentType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.FieldAdornment;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpContent;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpRole;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValue;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSource;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.core.model.metadata.tables.UniqueKey;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Records matrix area. Everything
 ** here is synthetic, QRun-owned test data layered on the stock sample.
 **
 ** Record Lab (app "Records Lab") declares every field adornment, field and
 ** section help content in each format and screen role, a hidden field, a
 ** unique key, field-level audits (with the standard audit tables and the
 ** GetAuditsForRecord process) and two file fields (a heavy BLOB named by a
 ** companion field, and a BLOB named by a format).
 *******************************************************************************/
final class RecordsFixtures
{
   static final String APP_NAME        = "recordsLab";
   static final String TABLE_NAME      = "recordLab";
   static final String STATUS_PVS_NAME = "recordLabStatus";
   static final String WIDGET_NAME     = "recordLabSummary";



   /*******************************************************************************
    **
    *******************************************************************************/
   private RecordsFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (tables, fields, processes, widgets, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance instance) throws QException
   {
      new AuditsMetaDataProvider().defineAll(instance, SampleMetaDataProvider.RDBMS_BACKEND_NAME, RecordsFixtures::useSnakeCaseNames);

      instance.addPossibleValueSource(new QPossibleValueSource()
         .withName(STATUS_PVS_NAME)
         .withLabel("Record Lab Status")
         .withEnumValues(new ArrayList<>(List.of(
            new QPossibleValue<>("DRAFT", "Draft"),
            new QPossibleValue<>("ACTIVE", "Active"),
            new QPossibleValue<>("RETIRED", "Retired")))));

      instance.addWidget(new QWidgetMetaData()
         .withName(WIDGET_NAME)
         .withLabel("Record Lab Summary")
         .withType(WidgetType.HTML.getType())
         .withCodeReference(new QCodeReference(SummaryWidgetRenderer.class)));

      QTableMetaData table = new QTableMetaData()
         .withName(TABLE_NAME)
         .withLabel("Record Lab")
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withPrimaryKeyField("id")
         .withRecordLabelFormat("Lab: %s")
         .withRecordLabelFields("title")
         .withUniqueKey(new UniqueKey("title"))
         .withAuditRules(new QAuditRules().withAuditLevel(AuditLevel.FIELD))
         .withIcon(new QIcon("biotech"))
         .withHelpContent("summary", new QHelpContent().withContentAsText("Record Lab exercises every record screen feature."))
         .withCustomizer(TableCustomizers.POST_QUERY_RECORD, new QCodeReference(PostQuery.class))

         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("title", QFieldType.STRING).withIsRequired(true).withMaxLength(60)
            .withHelpContent(new QHelpContent().withContentAsText("The headline shown for this record.").withRole(QHelpRole.READ_SCREENS))
            .withHelpContent(new QHelpContent().withContentAsMarkdown("Use a **short**, unique title.").withRole(QHelpRole.WRITE_SCREENS)))
         .withField(new QFieldMetaData("status", QFieldType.STRING).withPossibleValueSourceName(STATUS_PVS_NAME).withDefaultValue("DRAFT")
            .withFieldAdornment(new FieldAdornment(AdornmentType.CHIP)
               .withValue(AdornmentType.ChipValues.colorValue("DRAFT", AdornmentType.ChipValues.COLOR_INFO))
               .withValue(AdornmentType.ChipValues.colorValue("ACTIVE", AdornmentType.ChipValues.COLOR_SUCCESS))
               .withValue(AdornmentType.ChipValues.colorValue("RETIRED", AdornmentType.ChipValues.COLOR_ERROR))
               .withValue(AdornmentType.ChipValues.iconValue("ACTIVE", "check_circle"))))
         .withField(new QFieldMetaData("ownerId", QFieldType.INTEGER).withPossibleValueSourceName(SampleMetaDataProvider.TABLE_NAME_PERSON).withLabel("Owner")
            .withHelpContent(new QHelpContent().withContentAsText("Pick the person who owns this record.").withRole(QHelpRole.INSERT_SCREEN)))
         .withField(new QFieldMetaData("website", QFieldType.STRING).withMaxLength(250)
            .withFieldAdornment(new FieldAdornment(AdornmentType.LINK).withValue(AdornmentType.LinkValues.TARGET, "_blank"))
            .withHelpContent(new QHelpContent().withContentAsHTML("Opens <em>outside</em> this application.").withRole(QHelpRole.VIEW_SCREEN))
            .withHelpContent(new QHelpContent().withContentAsText("Include the https:// prefix.").withRole(QHelpRole.INSERT_SCREEN))
            .withHelpContent(new QHelpContent().withContentAsText("Changing the address updates every link.").withRole(QHelpRole.EDIT_SCREEN)))
         .withField(new QFieldMetaData("shortCode", QFieldType.STRING).withMaxLength(12)
            .withFieldAdornment(AdornmentType.Size.SMALL.toAdornment()))
         .withField(new QFieldMetaData("config", QFieldType.TEXT)
            .withFieldAdornment(new FieldAdornment(AdornmentType.CODE_EDITOR).withValue(AdornmentType.CodeEditorValues.languageMode("json"))))
         .withField(new QFieldMetaData("htmlNote", QFieldType.STRING).withMaxLength(250).withLabel("HTML Note")
            .withFieldAdornment(new FieldAdornment(AdornmentType.RENDER_HTML)))
         .withField(new QFieldMetaData("apiToken", QFieldType.PASSWORD).withLabel("API Token")
            .withFieldAdornment(new FieldAdornment(AdornmentType.REVEAL)))
         .withField(new QFieldMetaData("hint", QFieldType.STRING).withMaxLength(250)
            .withFieldAdornment(new FieldAdornment(AdornmentType.TOOLTIP).withValue(AdornmentType.TooltipValues.STATIC_TEXT, "Hints are advisory only.")))
         .withField(new QFieldMetaData("problem", QFieldType.STRING).withMaxLength(250)
            .withFieldAdornment(new FieldAdornment(AdornmentType.ERROR)))
         .withField(new QFieldMetaData("summaryWidget", QFieldType.STRING).withIsEditable(false).withLabel("Summary")
            .withFieldAdornment(new FieldAdornment(AdornmentType.WIDGET).withValue(AdornmentType.WidgetValues.WIDGET_NAME, WIDGET_NAME)))
         .withField(new QFieldMetaData("attachment", QFieldType.BLOB).withIsHeavy(true)
            .withFieldAdornment(new FieldAdornment(AdornmentType.FILE_DOWNLOAD)
               .withValue(AdornmentType.FileDownloadValues.FILE_NAME_FIELD, "attachmentName")
               .withValue(AdornmentType.FileDownloadValues.DEFAULT_MIME_TYPE, "text/plain"))
            .withFieldAdornment(new FieldAdornment(AdornmentType.FILE_UPLOAD).withValue(AdornmentType.FileUploadAdornment.formatDragAndDrop())))
         .withField(new QFieldMetaData("attachmentName", QFieldType.STRING).withMaxLength(250).withIsEditable(false))
         .withField(new QFieldMetaData("notesFile", QFieldType.BLOB)
            .withFieldAdornment(new FieldAdornment(AdornmentType.FILE_DOWNLOAD)
               .withValue(AdornmentType.FileDownloadValues.FILE_NAME_FORMAT, "Record %s Notes")
               .withValue(AdornmentType.FileDownloadValues.FILE_NAME_FORMAT_FIELDS, new ArrayList<>(List.of("id")))
               .withValue(AdornmentType.FileDownloadValues.DEFAULT_EXTENSION, "txt")
               .withValue(AdornmentType.FileDownloadValues.DEFAULT_MIME_TYPE, "text/plain"))
            .withFieldAdornment(new FieldAdornment(AdornmentType.FILE_UPLOAD).withValue(AdornmentType.FileUploadAdornment.formatButton())))
         .withField(new QFieldMetaData("hiddenCode", QFieldType.STRING).withMaxLength(40).withIsHidden(true))
         .withField(new QFieldMetaData("legacyCode", QFieldType.STRING).withMaxLength(40))
         .withField(new QFieldMetaData("createDate", QFieldType.DATE_TIME).withIsEditable(false))
         .withField(new QFieldMetaData("modifyDate", QFieldType.DATE_TIME).withIsEditable(false))

         .withSection(new QFieldSection("summary", new QIcon("label"), Tier.T1, List.of("id", "title", "status")))
         .withSection(new QFieldSection("links", new QIcon("link"), Tier.T2, List.of("ownerId", "website")))
         .withSection(new QFieldSection("presentation", new QIcon("palette"), Tier.T2, List.of("shortCode", "config", "htmlNote", "apiToken", "hint", "problem", "summaryWidget"))
            .withHelpContent(new QHelpContent().withContentAsHTML("These fields show each <b>adornment</b>.")))
         .withSection(new QFieldSection("files", new QIcon("attach_file"), Tier.T2, List.of("attachment", "attachmentName", "notesFile")))
         .withSection(new QFieldSection("dates", new QIcon("calendar_month"), Tier.T3, List.of("createDate", "modifyDate")))
         .withSection(new QFieldSection("legacy", new QIcon("inventory"), Tier.T2, List.of("legacyCode")).withIsHidden(true));
      useSnakeCaseNames(table);
      instance.addTable(table);

      instance.addApp(new QAppMetaData()
         .withName(APP_NAME)
         .withLabel("Records Lab")
         .withIcon(new QIcon("biotech"))
         .withChild(instance.getTable(TABLE_NAME)));
   }



   /*******************************************************************************
    ** snake_case table and column names, as the sample uses for its own tables.
    *******************************************************************************/
   private static void useSnakeCaseNames(QTableMetaData table)
   {
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
      QInstanceEnricher.setInferredFieldBackendNames(table);
   }



   /*******************************************************************************
    ** Create and seed fixture tables; runs at startup and on every /acceptance/reset,
    ** after the stock prime-test-database.sql.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         for(String sql : List.of(
            "DROP TABLE IF EXISTS audit_detail",
            "DROP TABLE IF EXISTS audit",
            "DROP TABLE IF EXISTS audit_user",
            "DROP TABLE IF EXISTS audit_table",
            "DROP TABLE IF EXISTS record_lab",
            """
               CREATE TABLE audit_table (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(250) NOT NULL UNIQUE, label VARCHAR(250),
                  create_date TIMESTAMP, modify_date TIMESTAMP)""",
            """
               CREATE TABLE audit_user (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(250) NOT NULL UNIQUE,
                  create_date TIMESTAMP, modify_date TIMESTAMP)""",
            """
               CREATE TABLE audit (id BIGINT AUTO_INCREMENT PRIMARY KEY, audit_table_id INTEGER, audit_user_id INTEGER, record_id INTEGER,
                  message VARCHAR(250), `timestamp` TIMESTAMP)""",
            """
               CREATE TABLE audit_detail (id BIGINT AUTO_INCREMENT PRIMARY KEY, audit_id BIGINT, message VARCHAR(250), field_name VARCHAR(100),
                  old_value VARCHAR(250), new_value VARCHAR(250))""",
            """
               CREATE TABLE record_lab (id INTEGER AUTO_INCREMENT PRIMARY KEY, title VARCHAR(60) NOT NULL UNIQUE, status VARCHAR(20),
                  owner_id INTEGER, website VARCHAR(250), short_code VARCHAR(12), config TEXT, html_note VARCHAR(250), api_token VARCHAR(250),
                  hint VARCHAR(250), problem VARCHAR(250), summary_widget VARCHAR(250), attachment BLOB, attachment_name VARCHAR(250),
                  notes_file BLOB, hidden_code VARCHAR(40), legacy_code VARCHAR(40), create_date TIMESTAMP, modify_date TIMESTAMP)"""))
         {
            statement.execute(sql);
         }
      }

      try(PreparedStatement insert = connection.prepareStatement("""
         INSERT INTO record_lab (title, status, owner_id, website, short_code, config, html_note, api_token, hint, problem,
            attachment, attachment_name, notes_file, hidden_code, legacy_code, create_date, modify_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TIMESTAMP '2026-01-15 14:30:00', TIMESTAMP '2026-02-01 09:05:00')"""))
      {
         insertLab(insert, "Alpha", "ACTIVE", 1, "https://example.invalid/alpha", "ALPHA-01", "{\"enabled\":true,\"limit\":3}",
            "<i>Italic</i> <script>window.recordLabXss = true</script>note", "tok-alpha-123", "Check twice", "Needs review",
            "alpha attachment bytes", "alpha.txt", "alpha notes", "H-ALPHA", "L-ALPHA");
         insertLab(insert, "Beta", "DRAFT", null, null, null, null, null, null, null, null, null, null, null, "H-BETA", null);
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void insertLab(PreparedStatement insert, Object... values) throws Exception
   {
      for(int index = 0; index < values.length; index++)
      {
         Object value = values[index];
         boolean isBlob = index == 10 || index == 12;
         insert.setObject(index + 1, isBlob && value != null ? ((String) value).getBytes(StandardCharsets.UTF_8) : value);
      }
      insert.executeUpdate();
   }



   /*******************************************************************************
    ** Supplies the WIDGET-adorned field's value (the widget's data) and the
    ** dynamic tooltip display value, as a real application's customizer would.
    *******************************************************************************/
   public static class PostQuery implements TableCustomizerInterface
   {
      /***************************************************************************
       **
       ***************************************************************************/
      @Override
      public List<QRecord> postQuery(QueryOrGetInputInterface queryInput, List<QRecord> records) throws QException
      {
         for(QRecord record : records)
         {
            String title = record.getValueString("title");
            record.setValue("summaryWidget", new RawHTML("Summary", "<p class=\"record-lab-summary\">Summary for " + escape(title) + "</p>"));
         }
         return (records);
      }
   }



   /*******************************************************************************
    ** Data for the summary widget when loaded on its own (the WIDGET adornment
    ** renders it with the field value instead).
    *******************************************************************************/
   public static class SummaryWidgetRenderer extends AbstractWidgetRenderer
   {
      /***************************************************************************
       **
       ***************************************************************************/
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input) throws QException
      {
         return (new RenderWidgetOutput(new RawHTML("Summary", "<p>Record Lab summary</p>")));
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static String escape(String text)
   {
      return (text == null ? "" : text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;"));
   }
}
