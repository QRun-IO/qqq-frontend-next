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

import java.io.File;
import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.processes.BackendStep;
import com.kingsrook.qqq.backend.core.actions.metadata.MetaDataActionCustomizerInterface;
import com.kingsrook.qqq.backend.core.actions.processes.ProcessFileDownload;
import com.kingsrook.qqq.backend.core.actions.tables.QueryAction;
import com.kingsrook.qqq.backend.core.context.QContext;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.exceptions.QUserFacingException;
import com.kingsrook.qqq.backend.core.model.actions.metadata.MetaDataInput;
import com.kingsrook.qqq.backend.core.model.actions.processes.ProcessMetaDataAdjustment;
import com.kingsrook.qqq.backend.core.model.actions.processes.RunBackendStepInput;
import com.kingsrook.qqq.backend.core.model.actions.processes.RunBackendStepOutput;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QCriteriaOperator;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QFilterCriteria;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QFilterOrderBy;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QQueryFilter;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QueryInput;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QueryOutput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.CompositeWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.RawHTML;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.AbstractBlockWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.inputfield.InputFieldBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.inputfield.InputFieldValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextValues;
import com.kingsrook.qqq.backend.core.model.data.QRecord;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaDataInterface;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.help.HelpFormat;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpContent;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpRole;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppChildMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppSection;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValue;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSource;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSourceType;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QBackendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QComponentType;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendComponentMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFunctionInputMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.ProcessStepFlow;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QProcessMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QStateMachineStep;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QRecordListMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.savedbulkloadprofiles.SavedBulkLoadProfileMetaDataProvider;
import com.kingsrook.qqq.backend.core.model.session.QSession;
import com.kingsrook.qqq.backend.core.model.session.QUser;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.utils.JsonUtils;
import com.kingsrook.qqq.backend.module.rdbms.jdbc.ConnectionManager;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.MaterialDashboardInstanceMetaData;
import com.kingsrook.qqq.middleware.javalin.QJavalinMetaData;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Processes matrix area. Everything
 ** here is synthetic, QRun-owned test data layered on the stock sample: a
 ** process lab app whose processes exercise every supported frontend component,
 ** multi-step navigation, dynamic step lists, progress, cancellation, failures
 ** and record bounds, plus an owned specimen table and a memory upload archive
 ** so bulk loads can receive files through the upload route.
 *******************************************************************************/
public final class ProcessesFixtures
{
   static final String APP_NAME            = "prcLab";
   static final String TABLE_SPECIMEN      = "prcSpecimen";
   static final String TABLE_UPLOADS       = "prcUploadArchive";
   static final String WIDGET_HTML         = "prcHtmlWidget";
   static final String WIDGET_COMPOSITE    = "prcCompositeWidget";
   static final String PROCESS_COMPONENTS  = "prcComponents";
   static final String PROCESS_WIZARD      = "prcWizard";
   static final String PROCESS_PROGRESS    = "prcProgress";
   static final String PROCESS_BOUNDS      = "prcBounds";
   static final String PROCESS_FLAKY       = "prcFlaky";
   static final String PROCESS_FAILURES    = "prcFailures";
   static final String PROCESS_WIDGETS     = "prcWidgets";
   static final String PROCESS_DRIVE       = "prcDrive";
   static final String PROCESS_EARLY       = "prcEarlyFinish";
   static final String PROCESS_MANY        = "prcManyRows";
   static final String PROCESS_SCANNER     = "prcScanner";
   static final String PROCESS_LOOP        = "prcLoop";
   static final String PROCESS_QUICK       = "prcQuickTask";
   static final String PROCESS_TAG         = "prcTagRecords";
   static final String PROCESS_PICK        = "prcSpecimenPick";

   static final AtomicInteger FLAKY_CALLS = new AtomicInteger();



   private ProcessesFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (tables, fields, processes, widgets, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance instance) throws QException
   {
      ///////////////////////////////////////////////////////////////////////
      // saved bulk load profiles (store/query/delete processes) on owned  //
      // snake_case tables that prime() recreates                         //
      ///////////////////////////////////////////////////////////////////////
      new SavedBulkLoadProfileMetaDataProvider().defineAll(instance, SampleMetaDataProvider.RDBMS_BACKEND_NAME, table ->
      {
         table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
         QInstanceEnricher.setInferredFieldBackendNames(table);
      });

      ////////////////////////////////////////////////////////////////////////////
      // uploads need an archive table; memory storage keeps the bytes in-process //
      ////////////////////////////////////////////////////////////////////////////
      instance.addTable(new QTableMetaData()
         .withName(TABLE_UPLOADS)
         .withLabel("Process Upload Archive")
         .withBackendName(SampleMetaDataProvider.MEMORY_BACKEND_NAME)
         .withPrimaryKeyField("reference")
         .withIsHidden(true)
         .withField(new QFieldMetaData("reference", QFieldType.STRING))
         .withField(new QFieldMetaData("contents", QFieldType.BLOB)));
      QJavalinMetaData.ofOrWithNew(instance).setUploadedFileArchiveTableName(TABLE_UPLOADS);

      instance.addTable(new QTableMetaData()
         .withName(TABLE_SPECIMEN)
         .withLabel("Lab Specimen")
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withBackendDetails(new RDBMSTableBackendDetails().withTableName("prc_specimen"))
         .withPrimaryKeyField("id")
         .withRecordLabelFormatAndFields("%s", "name")
         .withIcon(new QIcon().withName("science"))
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("category", QFieldType.STRING))
         .withField(new QFieldMetaData("quantity", QFieldType.INTEGER)));

      instance.addPossibleValueSource(enumSource("prcColor", "Lab Color", List.of(
         new QPossibleValue<>("red", "Red"), new QPossibleValue<>("green", "Green"), new QPossibleValue<>("blue", "Blue"))));
      instance.addPossibleValueSource(enumSource("prcRoute", "Route", List.of(
         new QPossibleValue<>("short", "Short route"), new QPossibleValue<>("long", "Long route"))));
      instance.addPossibleValueSource(enumSource("prcFailureMode", "Failure Mode", List.of(
         new QPossibleValue<>("userFacing", "User-facing failure"), new QPossibleValue<>("internal", "Internal failure"))));
      instance.addPossibleValueSource(enumSource("prcSpecimenCategory", "Specimen Category", List.of(
         new QPossibleValue<>("Mineral", "Mineral"), new QPossibleValue<>("Plant", "Plant"), new QPossibleValue<>("Fungus", "Fungus"))));
      instance.addPossibleValueSource(QPossibleValueSource.newForTable(TABLE_SPECIMEN));

      instance.addWidget(new QWidgetMetaData()
         .withName(WIDGET_HTML)
         .withLabel("Lab Status Widget")
         .withType(WidgetType.HTML.getType())
         .withCodeReference(new QCodeReference(HtmlWidgetRenderer.class)));
      instance.addWidget(new QWidgetMetaData()
         .withName(WIDGET_COMPOSITE)
         .withLabel("Lab Composite Widget")
         .withType(WidgetType.COMPOSITE.getType())
         .withCodeReference(new QCodeReference(CompositeWidgetRenderer.class)));

      instance.addProcess(defineComponents());
      instance.addProcess(defineWizard());
      instance.addProcess(defineProgress());
      instance.addProcess(defineBounds());
      instance.addProcess(defineFlaky());
      instance.addProcess(defineFailures());
      instance.addProcess(defineWidgets());
      instance.addProcess(defineDrive());
      instance.addProcess(defineEarlyFinish());
      instance.addProcess(defineManyRows());
      instance.addProcess(defineScanner());
      instance.addProcess(defineLoop());
      instance.addProcess(definePick());
      instance.addProcess(new QProcessMetaData()
         .withName(PROCESS_QUICK)
         .withLabel("Quick Task")
         .withIcon(new QIcon().withName("bolt"))
         .withStep(backend("run", QuickTaskStep.class)));

      //////////////////////////////////////////////////////////////////////////////////////
      // a table-less process in no app, which the Material dashboard instance metadata     //
      // adds to every table's query and record screens (like runRecordScript). Only the    //
      // sample user casey receives it in metadata, so other areas' screens are unchanged.  //
      //////////////////////////////////////////////////////////////////////////////////////
      instance.addProcess(defineTagRecords());
      MaterialDashboardInstanceMetaData.ofOrWithNew(instance).addProcessNameToAddToAllQueryAndViewScreens(PROCESS_TAG);
      instance.setMetaDataActionCustomizer(new QCodeReference(TagRecordsAudience.class));

      List<QAppChildMetaData> children = new ArrayList<>();
      children.add(instance.getTable(TABLE_SPECIMEN));
      for(String processName : List.of(PROCESS_COMPONENTS, PROCESS_WIZARD, PROCESS_PROGRESS, PROCESS_BOUNDS, PROCESS_FLAKY, PROCESS_FAILURES, PROCESS_WIDGETS, PROCESS_DRIVE, PROCESS_EARLY, PROCESS_MANY, PROCESS_SCANNER, PROCESS_LOOP, PROCESS_QUICK, PROCESS_PICK))
      {
         children.add(instance.getProcess(processName));
      }
      instance.addApp(new QAppMetaData()
         .withName(APP_NAME)
         .withLabel("Process Lab")
         .withIcon(new QIcon().withName("biotech"))
         .withWidgets(List.of(WIDGET_HTML))
         .withSectionOfChildren(new QAppSection().withName("lab").withLabel("Lab").withIcon(new QIcon().withName("biotech")), children));
   }



   /*******************************************************************************
    ** Create and seed fixture tables; runs at startup and on every /acceptance/reset,
    ** after the stock prime-test-database.sql.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      FLAKY_CALLS.set(0);
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS prc_specimen");
         statement.execute("CREATE TABLE prc_specimen (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, category VARCHAR(80), quantity INT)");
         statement.execute("INSERT INTO prc_specimen (id, name, category, quantity) VALUES (1, 'Alpha', 'Mineral', 10), (2, 'Beta', 'Mineral', 20), (3, 'Gamma', 'Plant', 30), (4, 'Delta', 'Plant', 40), (5, 'Epsilon', 'Fungus', 50)");
         statement.execute("ALTER TABLE prc_specimen ALTER COLUMN id RESTART WITH 100");

         statement.execute("DROP TABLE IF EXISTS shared_saved_bulk_load_profile");
         statement.execute("DROP TABLE IF EXISTS saved_bulk_load_profile");
         statement.execute("CREATE TABLE saved_bulk_load_profile (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP, modify_date TIMESTAMP, label VARCHAR(250), table_name VARCHAR(250), user_id VARCHAR(250), mapping_json TEXT, is_bulk_edit BOOLEAN)");
         statement.execute("CREATE TABLE shared_saved_bulk_load_profile (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP, modify_date TIMESTAMP, saved_bulk_load_profile_id INTEGER, user_id VARCHAR(250), scope VARCHAR(30), UNIQUE(saved_bulk_load_profile_id, user_id))");

         for(String table : List.of("prc_lab_run", "prc_route_log", "prc_progress_log", "prc_cancel_log", "prc_decision_log", "prc_drive_log", "prc_pick_log"))
         {
            statement.execute("DROP TABLE IF EXISTS " + table);
         }
         statement.execute("CREATE TABLE prc_lab_run (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80), lab_count INT, color VARCHAR(20))");
         statement.execute("CREATE TABLE prc_route_log (id INT AUTO_INCREMENT PRIMARY KEY, route VARCHAR(20), note VARCHAR(200), detail VARCHAR(200))");
         statement.execute("CREATE TABLE prc_progress_log (id INT AUTO_INCREMENT PRIMARY KEY, item_count INT)");
         statement.execute("CREATE TABLE prc_cancel_log (id INT AUTO_INCREMENT PRIMARY KEY, item_count INT, note VARCHAR(80))");
         statement.execute("CREATE TABLE prc_decision_log (id INT AUTO_INCREMENT PRIMARY KEY, action_code VARCHAR(40), scan_code VARCHAR(80))");
         statement.execute("CREATE TABLE prc_drive_log (id INT AUTO_INCREMENT PRIMARY KEY, note VARCHAR(200), folder_id VARCHAR(200))");
         statement.execute("DROP TABLE IF EXISTS prc_tag_log");
         statement.execute("CREATE TABLE prc_tag_log (id INT AUTO_INCREMENT PRIMARY KEY, table_name VARCHAR(80), record_id VARCHAR(80))");
         statement.execute("CREATE TABLE prc_pick_log (id INT AUTO_INCREMENT PRIMARY KEY, category VARCHAR(80), specimen_id INT)");
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QPossibleValueSource enumSource(String name, String label, List<QPossibleValue<?>> values)
   {
      return new QPossibleValueSource()
         .withName(name)
         .withLabel(label)
         .withType(QPossibleValueSourceType.ENUM)
         .withEnumValues(values);
   }



   /*******************************************************************************
    ** Every simple component type on one screen, in a declared order, then a
    ** review screen with a real download and a back step.
    *******************************************************************************/
   private static QProcessMetaData defineComponents()
   {
      return new QProcessMetaData()
         .withName(PROCESS_COMPONENTS)
         .withLabel("Component Lab")
         .withIcon(new QIcon().withName("science"))
         .withStep(backend("prepare", PrepareComponentsStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("mixed")
            .withLabel("Mixed Components")
            .withHelpContent(new QHelpContent().withContent("Complete every section before continuing.").withFormat(HelpFormat.TEXT).withRole(QHelpRole.PROCESS_SCREEN))
            .withComponent(component(QComponentType.HELP_TEXT).withValue("text", "Enter the lab values below.\nEvery value is saved with the run."))
            .withComponent(component(QComponentType.HELP_TEXT).withValue("previewText", "lab safety notes").withValue("text", "Wear goggles.\nLabel every sample."))
            .withComponent(component(QComponentType.VIEW_FORM))
            .withComponent(component(QComponentType.EDIT_FORM).withValue("sectionLabel", "Lab Inputs").withValue("includeFieldNames", new ArrayList<>(List.of("labName", "labCount"))))
            .withComponent(component(QComponentType.HTML))
            .withComponent(component(QComponentType.EDIT_FORM).withValue("includeFieldNames", new ArrayList<>(List.of("labColor"))))
            .withViewField(new QFieldMetaData("labIntro", QFieldType.STRING).withLabel("Introduction"))
            .withViewField(new QFieldMetaData("labStatus", QFieldType.STRING).withLabel("Status"))
            .withFormField(new QFieldMetaData("labName", QFieldType.STRING).withLabel("Lab Name").withIsRequired(true))
            .withFormField(new QFieldMetaData("labCount", QFieldType.INTEGER).withLabel("Sample Count"))
            .withFormField(new QFieldMetaData("labColor", QFieldType.STRING).withLabel("Lab Color").withPossibleValueSourceName("prcColor")))
         .withStep(new QBackendStepMetaData()
            .withName("compute")
            .withCode(new QCodeReference(ComputeStep.class))
            .withInputData(new QFunctionInputMetaData()
               .withField(new QFieldMetaData("labName", QFieldType.STRING).withIsRequired(true))
               .withField(new QFieldMetaData("labCount", QFieldType.INTEGER))
               .withField(new QFieldMetaData("labColor", QFieldType.STRING))))
         .withStep(new QFrontendStepMetaData()
            .withName("review")
            .withLabel("Review Lab")
            .withBackStepName("mixed")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withComponent(component(QComponentType.DOWNLOAD_FORM))
            .withViewField(new QFieldMetaData("labName", QFieldType.STRING).withLabel("Lab Name"))
            .withViewField(new QFieldMetaData("labCount", QFieldType.INTEGER).withLabel("Sample Count"))
            .withViewField(new QFieldMetaData("labColor", QFieldType.STRING).withLabel("Lab Color").withPossibleValueSourceName("prcColor"))
            .withViewField(new QFieldMetaData("resultMessage", QFieldType.STRING).withLabel("Result")))
         .withStep(backend("finish", FinishComponentsStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("done")
            .withLabel("Done")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("finalMessage", QFieldType.STRING).withLabel("Final Message")));
   }



   /*******************************************************************************
    ** Dynamic step list, updated field metadata and back steps.
    *******************************************************************************/
   private static QProcessMetaData defineWizard()
   {
      return new QProcessMetaData()
         .withName(PROCESS_WIZARD)
         .withLabel("Route Wizard")
         .withIcon(new QIcon().withName("alt_route"))
         .withStep(new QFrontendStepMetaData()
            .withName("chooseRoute")
            .withLabel("Choose Route")
            .withComponent(component(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("route", QFieldType.STRING).withLabel("Route").withPossibleValueSourceName("prcRoute").withIsRequired(true))
            .withFormField(new QFieldMetaData("routeNote", QFieldType.STRING).withLabel("Route Note")))
         .withStep(backend("planRoute", PlanRouteStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("longDetails")
            .withLabel("Long Route Details")
            .withBackStepName("chooseRoute")
            .withComponent(component(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("detail", QFieldType.STRING).withLabel("Detail")))
         .withStep(backend("recordRoute", RecordRouteStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("confirm")
            .withLabel("Confirm Route")
            .withBackStepName("chooseRoute")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("route", QFieldType.STRING).withLabel("Route").withPossibleValueSourceName("prcRoute"))
            .withViewField(new QFieldMetaData("routeNote", QFieldType.STRING).withLabel("Route Note"))
            .withViewField(new QFieldMetaData("detail", QFieldType.STRING).withLabel("Detail")));
   }



   /*******************************************************************************
    ** A screen whose Specimen choices are filtered to its Category through
    ** ${input.category} (the screen's values sent with the possible-value search),
    ** a step that records the pick, and a result screen (PRC-051).
    *******************************************************************************/
   private static QProcessMetaData definePick()
   {
      return new QProcessMetaData()
         .withName(PROCESS_PICK)
         .withLabel("Specimen Pick")
         .withIcon(new QIcon().withName("checklist"))
         .withStep(new QFrontendStepMetaData()
            .withName("pick")
            .withLabel("Pick a Specimen")
            .withComponent(component(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("category", QFieldType.STRING).withLabel("Category").withPossibleValueSourceName("prcSpecimenCategory"))
            .withFormField(new QFieldMetaData("specimenId", QFieldType.INTEGER).withLabel("Specimen").withIsRequired(true).withPossibleValueSourceName(TABLE_SPECIMEN)
               .withPossibleValueSourceFilter(new QQueryFilter(new QFilterCriteria("category", QCriteriaOperator.EQUALS, "${input.category}")))))
         .withStep(backend("recordPick", RecordPickStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("picked")
            .withLabel("Specimen Picked")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("category", QFieldType.STRING).withLabel("Category").withPossibleValueSourceName("prcSpecimenCategory"))
            .withViewField(new QFieldMetaData("specimenId", QFieldType.INTEGER).withLabel("Specimen").withPossibleValueSourceName(TABLE_SPECIMEN)));
   }



   /*******************************************************************************
    ** A slow step that reports progress, with a cancel step.
    *******************************************************************************/
   private static QProcessMetaData defineProgress()
   {
      return new QProcessMetaData()
         .withName(PROCESS_PROGRESS)
         .withLabel("Progress Lab")
         .withIcon(new QIcon().withName("hourglass_top"))
         .withCancelStep(backend("cancelWork", CancelWorkStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("configure")
            .withLabel("Configure")
            .withComponent(component(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("itemCount", QFieldType.INTEGER).withLabel("Item Count").withDefaultValue(4))
            .withFormField(new QFieldMetaData("delayMillis", QFieldType.INTEGER).withLabel("Delay Millis").withDefaultValue(1200)))
         .withStep(backend("work", ProgressWorkStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("finished")
            .withLabel("Finished")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("processedCount", QFieldType.INTEGER).withLabel("Processed Count")));
   }



   /*******************************************************************************
    ** A process with no table: it runs over the records of the screen it is launched
    ** from (the Material dashboard's processes added to every query and view screen).
    *******************************************************************************/
   private static QProcessMetaData defineTagRecords()
   {
      return new QProcessMetaData()
         .withName(PROCESS_TAG)
         .withLabel("Tag Records")
         .withIcon(new QIcon().withName("sell"))
         .withStep(backend("tag", TagRecordsStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("tagged")
            .withLabel("Tagged")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("taggedTable", QFieldType.STRING).withLabel("Tagged Table"))
            .withViewField(new QFieldMetaData("taggedCount", QFieldType.INTEGER).withLabel("Tagged Count"))
            .withViewField(new QFieldMetaData("taggedIds", QFieldType.STRING).withLabel("Tagged Ids")));
   }



   /*******************************************************************************
    ** A table process that requires one or two input records.
    *******************************************************************************/
   private static QProcessMetaData defineBounds()
   {
      return new QProcessMetaData()
         .withName(PROCESS_BOUNDS)
         .withLabel("Pick One or Two")
         .withTableName(TABLE_SPECIMEN)
         .withIcon(new QIcon().withName("filter_2"))
         .withMinInputRecords(1)
         .withMaxInputRecords(2)
         .withStep(new QBackendStepMetaData()
            .withName("collect")
            .withCode(new QCodeReference(CollectSpecimensStep.class))
            .withInputData(new QFunctionInputMetaData().withRecordListMetaData(new QRecordListMetaData().withTableName(TABLE_SPECIMEN))))
         .withStep(new QFrontendStepMetaData()
            .withName("picked")
            .withLabel("Picked Specimens")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withComponent(component(QComponentType.RECORD_LIST))
            .withViewField(new QFieldMetaData("selectedCount", QFieldType.INTEGER).withLabel("Selected Count"))
            .withViewField(new QFieldMetaData("selectedNames", QFieldType.STRING).withLabel("Selected Names"))
            .withRecordListField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id"))
            .withRecordListField(new QFieldMetaData("name", QFieldType.STRING).withLabel("Name")));
   }



   /*******************************************************************************
    ** A table process whose first run fails, so retry can be exercised.
    *******************************************************************************/
   private static QProcessMetaData defineFlaky()
   {
      return new QProcessMetaData()
         .withName(PROCESS_FLAKY)
         .withLabel("Flaky Loader")
         .withTableName(TABLE_SPECIMEN)
         .withIcon(new QIcon().withName("replay"))
         .withStep(new QBackendStepMetaData()
            .withName("load")
            .withCode(new QCodeReference(FlakyLoadStep.class))
            .withInputData(new QFunctionInputMetaData().withRecordListMetaData(new QRecordListMetaData().withTableName(TABLE_SPECIMEN))))
         .withStep(new QFrontendStepMetaData()
            .withName("loaded")
            .withLabel("Loaded")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withComponent(component(QComponentType.RECORD_LIST))
            .withViewField(new QFieldMetaData("loadedNames", QFieldType.STRING).withLabel("Loaded Names"))
            .withRecordListField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id"))
            .withRecordListField(new QFieldMetaData("name", QFieldType.STRING).withLabel("Name")));
   }



   /*******************************************************************************
    ** User-facing and internal step failures.
    *******************************************************************************/
   private static QProcessMetaData defineFailures()
   {
      return new QProcessMetaData()
         .withName(PROCESS_FAILURES)
         .withLabel("Failure Lab")
         .withIcon(new QIcon().withName("report"))
         .withStep(new QFrontendStepMetaData()
            .withName("chooseFailure")
            .withLabel("Choose Failure")
            .withComponent(component(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("failureMode", QFieldType.STRING).withLabel("Failure Mode").withPossibleValueSourceName("prcFailureMode").withIsRequired(true)))
         .withStep(backend("explode", ExplodeStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("unreachable")
            .withLabel("Unreachable")
            .withComponent(component(QComponentType.VIEW_FORM)));
   }



   /*******************************************************************************
    ** Named widgets (fetched and seeded from process values) and an ad hoc
    ** composite widget with text, input and button blocks.
    *******************************************************************************/
   private static QProcessMetaData defineWidgets()
   {
      ArrayList<AbstractBlockWidgetData<?, ?, ?, ?>> blocks = new ArrayList<>();
      blocks.add(new TextBlockData().withValues(new TextValues("Scan or choose for ${operator}")));
      blocks.add(new InputFieldBlockData().withValues(new InputFieldValues(new QFieldMetaData("scanCode", QFieldType.STRING).withLabel("Scan Code")).withSubmitOnEnter(true).withPlaceholder("Scan a code")));
      blocks.add(new ButtonBlockData().withValues(new ButtonValues("Approve", "approve")));
      blocks.add(new ButtonBlockData().withValues(new ButtonValues("Reject", "reject")));
      blocks.add(new TextBlockData().withValues(new TextValues("Secret block that must stay hidden")).withConditional("showSecret"));

      return new QProcessMetaData()
         .withName(PROCESS_WIDGETS)
         .withLabel("Widget Lab")
         .withIcon(new QIcon().withName("widgets"))
         .withStep(backend("prepareWidgets", PrepareWidgetsStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("interact")
            .withLabel("Interact")
            .withComponent(component(QComponentType.WIDGET).withValue("widgetName", WIDGET_HTML))
            .withComponent(component(QComponentType.WIDGET).withValue("widgetName", WIDGET_COMPOSITE))
            .withComponent(component(QComponentType.WIDGET).withValue("isAdHocWidget", true).withValue("blocks", blocks)))
         .withStep(backend("decide", DecideStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("decided")
            .withLabel("Decided")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("decision", QFieldType.STRING).withLabel("Decision"))
            .withViewField(new QFieldMetaData("scanCode", QFieldType.STRING).withLabel("Scan Code")));
   }



   /*******************************************************************************
    ** A Google Drive folder picker beside ordinary inputs.
    *******************************************************************************/
   private static QProcessMetaData defineDrive()
   {
      return new QProcessMetaData()
         .withName(PROCESS_DRIVE)
         .withLabel("Drive Export")
         .withIcon(new QIcon().withName("add_to_drive"))
         .withStep(new QFrontendStepMetaData()
            .withName("pickFolder")
            .withLabel("Pick Folder")
            .withComponent(component(QComponentType.HELP_TEXT).withValue("text", "Choose a destination folder and describe the export."))
            .withComponent(component(QComponentType.GOOGLE_DRIVE_SELECT_FOLDER))
            .withComponent(component(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("exportNote", QFieldType.STRING).withLabel("Export Note").withIsRequired(true)))
         .withStep(backend("exportIt", DriveExportStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("exported")
            .withLabel("Exported")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("exportNote", QFieldType.STRING).withLabel("Export Note")));
   }



   /*******************************************************************************
    ** A linear process that asks the frontend to stop early (noMoreSteps).
    *******************************************************************************/
   private static QProcessMetaData defineEarlyFinish()
   {
      return new QProcessMetaData()
         .withName(PROCESS_EARLY)
         .withLabel("Early Finish")
         .withIcon(new QIcon().withName("last_page"))
         .withStep(backend("start", EarlyFinishStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("notice")
            .withLabel("Notice")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("notice", QFieldType.STRING).withLabel("Notice")))
         .withStep(backend("never", EarlyFinishStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("neverShown")
            .withLabel("Never Shown")
            .withComponent(component(QComponentType.VIEW_FORM)));
   }



   /*******************************************************************************
    ** Generated process records for record-list paging.
    *******************************************************************************/
   private static QProcessMetaData defineManyRows()
   {
      return new QProcessMetaData()
         .withName(PROCESS_MANY)
         .withLabel("Many Rows")
         .withIcon(new QIcon().withName("table_rows"))
         .withStep(backend("generate", GenerateRowsStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("rows")
            .withLabel("Rows")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withComponent(component(QComponentType.RECORD_LIST))
            .withViewField(new QFieldMetaData("rowCount", QFieldType.INTEGER).withLabel("Row Count"))
            .withRecordListField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id"))
            .withRecordListField(new QFieldMetaData("label", QFieldType.STRING).withLabel("Row Label")));
   }



   /*******************************************************************************
    ** A scanner-format screen: no heading or buttons, the input block submits.
    *******************************************************************************/
   private static QProcessMetaData defineScanner()
   {
      ArrayList<AbstractBlockWidgetData<?, ?, ?, ?>> blocks = new ArrayList<>();
      blocks.add(new TextBlockData().withValues(new TextValues("Scan a specimen code")));
      blocks.add(new InputFieldBlockData().withValues(new InputFieldValues(new QFieldMetaData("scanCode", QFieldType.STRING).withLabel("Specimen Code")).withSubmitOnEnter(true).withAutoFocus(true)));

      return new QProcessMetaData()
         .withName(PROCESS_SCANNER)
         .withLabel("Scanner Station")
         .withIcon(new QIcon().withName("qr_code_scanner"))
         .withStep(new QFrontendStepMetaData()
            .withName("scan")
            .withLabel("Scan")
            .withFormat("scanner")
            .withComponent(component(QComponentType.WIDGET).withValue("isAdHocWidget", true).withValue("blocks", blocks)))
         .withStep(backend("decide", DecideStep.class))
         .withStep(new QFrontendStepMetaData()
            .withName("scanned")
            .withLabel("Scanned")
            .withComponent(component(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("scanCode", QFieldType.STRING).withLabel("Specimen Code")));
   }



   /*******************************************************************************
    ** A state-machine process whose backend step can repeat a screen.
    *******************************************************************************/
   private static QProcessMetaData defineLoop()
   {
      return new QProcessMetaData()
         .withName(PROCESS_LOOP)
         .withLabel("Loop Lab")
         .withIcon(new QIcon().withName("loop"))
         .withStepFlow(ProcessStepFlow.STATE_MACHINE)
         .withStep(QStateMachineStep.frontendThenBackend("ask",
            new QFrontendStepMetaData()
               .withName("askScreen")
               .withLabel("Another Round?")
               .withComponent(component(QComponentType.VIEW_FORM))
               .withComponent(component(QComponentType.EDIT_FORM))
               .withViewField(new QFieldMetaData("rounds", QFieldType.INTEGER).withLabel("Rounds"))
               .withFormField(new QFieldMetaData("again", QFieldType.BOOLEAN).withLabel("Go again")),
            backend("count", LoopStep.class)))
         .withStep(QStateMachineStep.frontendOnly("finish",
            new QFrontendStepMetaData()
               .withName("finishScreen")
               .withLabel("Finished Looping")
               .withComponent(component(QComponentType.VIEW_FORM))
               .withViewField(new QFieldMetaData("rounds", QFieldType.INTEGER).withLabel("Rounds"))));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QBackendStepMetaData backend(String name, Class<? extends BackendStep> step)
   {
      return new QBackendStepMetaData().withName(name).withCode(new QCodeReference(step));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QFrontendComponentMetaData component(QComponentType type)
   {
      return new QFrontendComponentMetaData().withType(type);
   }



   /*******************************************************************************
    ** Run one insert against the sample database.
    *******************************************************************************/
   static void insert(String sql, Serializable... values) throws QException
   {
      try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend());
          PreparedStatement statement = connection.prepareStatement(sql))
      {
         for(int i = 0; i < values.length; i++)
         {
            statement.setObject(i + 1, values[i]);
         }
         statement.executeUpdate();
      }
      catch(Exception e)
      {
         throw new QException("Fixture insert failed", e);
      }
   }



   public static class PrepareComponentsStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         output.addValue("mixed.html", "<p id=\"prc-html\"><strong>Lab briefing</strong> for <em>acceptance</em>.</p><script>window.prcXss = 1</script><img src=\"x\" onerror=\"window.prcXss = 2\">");
         output.addValue("labIntro", "Welcome to the lab");
         output.addValue("labStatus", "Ready");
      }
   }



   public static class ComputeStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         String  name  = input.getValueString("labName");
         Integer count = input.getValueInteger("labCount");
         String  color = input.getValueString("labColor");
         if(count != null && count < 0)
         {
            throw new QUserFacingException("Sample count must not be negative.");
         }
         insert("INSERT INTO prc_lab_run (name, lab_count, color) VALUES (?, ?, ?)", name, count, color);
         try
         {
            File file = File.createTempFile("prc-lab-", ".txt");
            file.deleteOnExit();
            Files.writeString(file.toPath(), "name=" + name + "\ncount=" + count + "\ncolor=" + color + "\n", StandardCharsets.UTF_8);
            output.addValue("downloadFileName", "lab-" + name + ".txt");
            output.addValue("serverFilePath", ProcessFileDownload.register(file));
         }
         catch(QException e)
         {
            throw e;
         }
         catch(Exception e)
         {
            throw new QException("Could not write the lab file", e);
         }
         output.addValue("resultMessage", "Saved lab " + name + " with " + count + " samples");
      }
   }



   public static class FinishComponentsStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output)
      {
         output.addValue("finalMessage", "Lab " + input.getValueString("labName") + " is complete");
      }
   }



   public static class PlanRouteStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         boolean isLong = "long".equals(input.getValueString("route"));
         output.setProcessName(input.getProcessName());
         output.updateStepList(isLong
            ? List.of("chooseRoute", "planRoute", "longDetails", "recordRoute", "confirm")
            : List.of("chooseRoute", "planRoute", "recordRoute", "confirm"));
         if(isLong)
         {
            ProcessMetaDataAdjustment adjustment = output.getProcessMetaDataAdjustment();
            adjustment.withUpdatedField(new QFieldMetaData("detail", QFieldType.STRING).withLabel("Long Route Detail").withIsRequired(true));
         }
         else
         {
            output.addValue("detail", null);
         }
      }
   }



   public static class RecordRouteStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         insert("INSERT INTO prc_route_log (route, note, detail) VALUES (?, ?, ?)", input.getValueString("route"), input.getValueString("routeNote"), input.getValueString("detail"));
      }
   }



   public static class RecordPickStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         insert("INSERT INTO prc_pick_log (category, specimen_id) VALUES (?, ?)", input.getValueString("category"), input.getValueInteger("specimenId"));
      }
   }



   public static class ProgressWorkStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         int total = Objects.requireNonNullElse(input.getValueInteger("itemCount"), 4);
         int delay = Objects.requireNonNullElse(input.getValueInteger("delayMillis"), 1200);
         for(int i = 1; i <= total; i++)
         {
            input.getAsyncJobCallback().updateStatus("Processing item " + i + " of " + total, i, total);
            try
            {
               Thread.sleep(delay);
            }
            catch(InterruptedException e)
            {
               Thread.currentThread().interrupt();
               throw new QException("Interrupted while working");
            }
         }
         insert("INSERT INTO prc_progress_log (item_count) VALUES (?)", total);
         output.addValue("processedCount", total);
      }
   }



   public static class CancelWorkStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         insert("INSERT INTO prc_cancel_log (item_count, note) VALUES (?, ?)", input.getValueInteger("itemCount"), "cancelled by user");
      }
   }



   public static class CollectSpecimensStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output)
      {
         output.addValue("selectedCount", input.getRecords().size());
         output.addValue("selectedNames", input.getRecords().stream().map(r -> r.getValueString("name")).collect(Collectors.joining(", ")));
      }
   }



   public static class FlakyLoadStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         if(FLAKY_CALLS.getAndIncrement() == 0)
         {
            throw new QUserFacingException("The lab loader is warming up. Please retry.");
         }
         output.addValue("loadedNames", input.getRecords().stream().map(r -> r.getValueString("name")).collect(Collectors.joining(", ")));
      }
   }



   public static class ExplodeStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         if("userFacing".equals(input.getValueString("failureMode")))
         {
            throw new QUserFacingException("The lab rejected this input.");
         }
         throw new QException("Lab internals failed at stage 7");
      }
   }



   public static class PrepareWidgetsStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output)
      {
         output.addValue("operator", "Casey Operator");
         output.addValue(WIDGET_COMPOSITE, new CompositeWidgetData()
            .withBlock(new TextBlockData().withValues(new TextValues("Seeded composite for ${operator}"))));
      }
   }



   public static class DecideStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         String actionCode = input.getValueString("actionCode");
         String scanCode   = input.getValueString("scanCode");
         insert("INSERT INTO prc_decision_log (action_code, scan_code) VALUES (?, ?)", actionCode, scanCode);
         output.addValue("decision", actionCode == null ? "scanned" : actionCode);
      }
   }



   public static class DriveExportStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         insert("INSERT INTO prc_drive_log (note, folder_id) VALUES (?, ?)", input.getValueString("exportNote"), input.getValueString("googleDriveFolderId"));
      }
   }



   public static class EarlyFinishStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output)
      {
         output.addValue("noMoreSteps", true);
         output.addValue("notice", "This process stops here by design.");
      }
   }



   /*******************************************************************************
    ** Metadata customizer: the all-screens tag process is listed only for the sample
    ** user casey; everything else is left to the permission rules.
    *******************************************************************************/
   public static class TagRecordsAudience implements MetaDataActionCustomizerInterface
   {
      @Override
      public boolean allowTable(MetaDataInput input, QTableMetaData table)
      {
         return (true);
      }



      @Override
      public boolean allowProcess(MetaDataInput input, QProcessMetaData process)
      {
         if(!PROCESS_TAG.equals(process.getName()))
         {
            return (true);
         }

         ////////////////////////////////////////////////////////////////////////
         // QInstance builds its table paths through MetaDataAction in a        //
         // temporary context whose session may have no user: deny it there.   //
         ////////////////////////////////////////////////////////////////////////
         QSession session = QContext.getQSession();
         QUser    user    = session == null ? null : session.getUser();
         return (user != null && "sample:casey".equals(user.getIdReference()));
      }



      @Override
      public boolean allowReport(MetaDataInput input, QReportMetaData report)
      {
         return (true);
      }



      @Override
      public boolean allowApp(MetaDataInput input, QAppMetaData app)
      {
         return (true);
      }



      @Override
      public boolean allowWidget(MetaDataInput input, QWidgetMetaDataInterface widget)
      {
         return (true);
      }
   }



   /*******************************************************************************
    ** Tags the records of whichever table launched it: the launching screen sends the
    ** table name and its selection (record ids or a filter) as process values.
    *******************************************************************************/
   public static class TagRecordsStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         QTableMetaData table = QContext.getQInstance().getTable(input.getValueString("tableName"));
         if(table == null)
         {
            throw (new QUserFacingException("No table was given to tag records from."));
         }
         QQueryFilter filter;
         String       recordsParam = input.getValueString("recordsParam");
         if("recordIds".equals(recordsParam))
         {
            List<Serializable> ids = new ArrayList<>(List.of(input.getValueString("recordIds").split(",")));
            filter = new QQueryFilter(new QFilterCriteria(table.getPrimaryKeyField(), QCriteriaOperator.IN, ids));
         }
         else if("filterJSON".equals(recordsParam))
         {
            try
            {
               filter = JsonUtils.toObject(input.getValueString("filterJSON"), QQueryFilter.class);
            }
            catch(Exception e)
            {
               throw (new QUserFacingException("The record filter could not be read."));
            }
         }
         else
         {
            throw (new QUserFacingException("No records were selected to tag."));
         }
         filter.setOrderBys(new ArrayList<>(List.of(new QFilterOrderBy(table.getPrimaryKeyField()))));
         QueryOutput  queryOutput = new QueryAction().execute(new QueryInput(table.getName()).withFilter(filter));
         List<String> tagged      = new ArrayList<>();
         for(QRecord record : queryOutput.getRecords())
         {
            String id = String.valueOf(record.getValue(table.getPrimaryKeyField()));
            insert("INSERT INTO prc_tag_log (table_name, record_id) VALUES (?, ?)", table.getName(), id);
            tagged.add(id);
         }
         output.addValue("taggedTable", table.getLabel());
         output.addValue("taggedCount", tagged.size());
         output.addValue("taggedIds", String.join(", ", tagged));
      }
   }



   public static class QuickTaskStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         insert("INSERT INTO prc_lab_run (name, lab_count, color) VALUES (?, ?, ?)", "quick", 1, "none");
      }
   }



   public static class LoopStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output)
      {
         int rounds = Objects.requireNonNullElse(input.getValueInteger("rounds"), 0) + 1;
         output.addValue("rounds", rounds);
         if(Boolean.TRUE.equals(input.getValueBoolean("again")))
         {
            output.addValue("again", null);
            output.getProcessState().setNextStepName("ask");
         }
         else
         {
            output.addValue("noMoreSteps", true);
            output.getProcessState().setNextStepName("finish");
         }
      }
   }



   public static class GenerateRowsStep implements BackendStep
   {
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output)
      {
         for(int i = 1; i <= 23; i++)
         {
            output.getRecords().add(new QRecord().withValue("id", i).withValue("label", "Row " + i));
         }
         output.addValue("rowCount", 23);
      }
   }



   public static class HtmlWidgetRenderer extends AbstractWidgetRenderer
   {
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input)
      {
         Map<String, String> params   = input.getQueryParams();
         String              operator = params == null ? null : params.get("operator");
         String              linked   = params != null && params.get("processUUID") != null ? "linked" : "unlinked";
         String              safe     = operator == null ? "nobody" : operator.replaceAll("[^A-Za-z ]", "");
         return new RenderWidgetOutput(new RawHTML("Lab Status", "<p>Lab status for <b>" + safe + "</b> (" + linked + ")</p>"));
      }
   }



   public static class CompositeWidgetRenderer extends AbstractWidgetRenderer
   {
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input)
      {
         return new RenderWidgetOutput(new CompositeWidgetData()
            .withBlock(new TextBlockData().withValues(new TextValues("Fetched composite"))));
      }
   }
}
