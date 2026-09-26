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

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.Serializable;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import javax.imageio.ImageIO;
import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ChildRecordListRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.CronUIWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.DefaultWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ParentWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ProcessWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.permissions.PermissionsHelper;
import com.kingsrook.qqq.backend.core.actions.permissions.ReportProcessPermissionChecker;
import com.kingsrook.qqq.backend.core.actions.permissions.TablePermissionSubType;
import com.kingsrook.qqq.backend.core.actions.tables.DeleteAction;
import com.kingsrook.qqq.backend.core.actions.tables.GetAction;
import com.kingsrook.qqq.backend.core.actions.tables.InsertAction;
import com.kingsrook.qqq.backend.core.context.QContext;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.model.actions.tables.delete.DeleteInput;
import com.kingsrook.qqq.backend.core.model.actions.tables.get.GetInput;
import com.kingsrook.qqq.backend.core.model.actions.tables.insert.InsertInput;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QCriteriaOperator;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QFilterCriteria;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QFilterOrderBy;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QQueryFilter;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.AlertData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.ChartData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.CompositeWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.CronUISetupData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.DividerWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.DynamicFormWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.FieldValueListData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.LocationData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.MultiStatisticsData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.MultiTableData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.ParentWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.QWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.RawHTML;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.RowBuilderData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.StatisticsData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.StepperData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.TableData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.USMapWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.audio.AudioBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.audio.AudioValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.bignumberblock.BigNumberBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.bignumberblock.BigNumberStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.bignumberblock.BigNumberValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.divider.DividerBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.icon.IconBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.icon.IconStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.icon.IconValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.image.ImageBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.image.ImageStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.image.ImageValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.inputfield.InputFieldBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.inputfield.InputFieldValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.numbericonbadge.NumberIconBadgeBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.numbericonbadge.NumberIconBadgeStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.numbericonbadge.NumberIconBadgeValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.progressbar.ProgressBarBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.progressbar.ProgressBarStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.progressbar.ProgressBarValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.tablesubrowdetailrow.TableSubRowDetailRowBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.tablesubrowdetailrow.TableSubRowDetailRowStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.tablesubrowdetailrow.TableSubRowDetailRowValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.upordownnumber.UpOrDownNumberBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.upordownnumber.UpOrDownNumberStyles;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.upordownnumber.UpOrDownNumberValues;
import com.kingsrook.qqq.backend.core.model.data.QRecord;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.ParentWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QuickSightChartMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.WidgetDropdownData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.WidgetDropdownType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.help.HelpFormat;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpContent;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinOn;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.QJoinMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValue;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSource;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSourceType;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportDataSource;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportField;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportView;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.ReportType;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.core.model.actions.reporting.pivottable.PivotTableDefinition;
import com.kingsrook.qqq.backend.core.model.actions.reporting.pivottable.PivotTableFunction;
import com.kingsrook.qqq.backend.core.model.actions.reporting.pivottable.PivotTableGroupBy;
import com.kingsrook.qqq.backend.core.model.actions.reporting.pivottable.PivotTableValue;
import com.kingsrook.qqq.backend.core.model.scripts.ScriptsMetaDataProvider;
import com.kingsrook.qqq.backend.core.model.session.QSystemUserSession;
import com.kingsrook.qqq.backend.core.processes.implementations.reports.BasicRunReportProcess;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.middleware.javalin.routeproviders.NextDashboardSecurityHeaders;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Widgets matrix area. Everything
 ** here is synthetic, QRun-owned test data layered on the stock sample:
 ** - dashboards (apps) holding owned widgets of every canonical widget type,
 **   in populated, empty, failing, malformed, parent/child and control shapes;
 ** - a record-view host table whose sections embed record widgets;
 ** - reports of every report type run through the basic report process;
 ** - a loopback fake service (the QuickSight protocol endpoint, an embeddable
 **   page, a custom component bundle, an image and an audio clip), so the real
 **   QuickSight renderer and dynamic components run without external accounts.
 *******************************************************************************/
final class WidgetsFixtures
{
   static final String GALLERY_APP     = "widgetGallery";
   static final String CONTROLS_APP    = "widgetControls";
   static final String STATES_APP      = "widgetStates";
   static final String PARENTS_APP     = "widgetParents";
   static final String BLOCKS_APP      = "widgetBlocks";
   static final String PROCESS_APP     = "widgetProcess";
   static final String PERMISSIONS_APP = "widgetPermissions";
   static final String RECORDS_APP     = "widgetRecords";
   static final String REPORTS_APP     = "acceptanceReports";

   static final String HOST_TABLE       = "accWidgetHost";
   static final String HOST_CHILD_TABLE = "accWidgetHostChild";
   static final String HOST_CHILD_JOIN  = "accWidgetHostJoinChild";
   static final String DATA_BAG_TABLE   = "dataBag";
   static final String DATA_BAG_VERSION = "dataBagVersion";

   static final String CHOICE_PVS = "accChoice";

   /////////////////////////////////////////////////////////////////////////
   // render counters, so reload and parameter changes are observable     //
   /////////////////////////////////////////////////////////////////////////
   private static final Map<String, AtomicInteger> RENDERS = new ConcurrentHashMap<>();

   private static volatile QInstance  instance;
   private static volatile HttpServer fakeService;
   private static volatile String     fakeBase;



   /*******************************************************************************
    **
    *******************************************************************************/
   private WidgetsFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (tables, fields, processes, widgets, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance qInstance) throws QException
   {
      instance = qInstance;
      startFakeService();

      qInstance.addPossibleValueSource(new QPossibleValueSource().withName(CHOICE_PVS).withLabel("Choice").withType(QPossibleValueSourceType.ENUM)
         .withEnumValues(List.of(new QPossibleValue<>("alpha", "Alpha"), new QPossibleValue<>("beta", "Beta"))));

      defineGallery(qInstance);
      defineControls(qInstance);
      defineStates(qInstance);
      defineParents(qInstance);
      defineBlocks(qInstance);
      defineProcessWidget(qInstance);
      definePermissions(qInstance);
      defineRecordWidgets(qInstance);
      defineReports(qInstance);
      repointSampleQuickSight(qInstance);
   }



   /*******************************************************************************
    ** Create and seed fixture tables; runs at startup and on every /acceptance/reset,
    ** after the stock prime-test-database.sql.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS acc_widget_host_child");
         statement.execute("DROP TABLE IF EXISTS acc_widget_host");
         statement.execute("DROP TABLE IF EXISTS data_bag_version");
         statement.execute("DROP TABLE IF EXISTS data_bag");
         statement.execute("CREATE TABLE acc_widget_host (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), owner VARCHAR(100), zero INTEGER, "
            + "cron_expression VARCHAR(100), cron_time_zone_id VARCHAR(100))");
         statement.execute("CREATE TABLE acc_widget_host_child (id INTEGER AUTO_INCREMENT PRIMARY KEY, host_id INTEGER, name VARCHAR(100))");
         statement.execute("INSERT INTO acc_widget_host (id, name, owner, zero, cron_expression, cron_time_zone_id) VALUES "
            + "(1, 'Owned host one', 'Owned owner one', 0, '0 0 9 * * ?', 'America/Chicago'), "
            + "(2, 'Owned host two', 'Owned owner two', 7, '0 30 12 ? * MON-FRI', 'UTC'), "
            + "(3, 'Owned host empty', 'Owned owner empty', 0, NULL, NULL)");
         statement.execute("INSERT INTO acc_widget_host_child (id, host_id, name) VALUES (1, 1, 'Owned child alpha'), (2, 1, 'Owned child beta'), "
            + "(3, 1, 'Owned child gamma'), (4, 2, 'Owned child delta')");
         statement.execute("ALTER TABLE acc_widget_host ALTER COLUMN id RESTART WITH 100");
         statement.execute("ALTER TABLE acc_widget_host_child ALTER COLUMN id RESTART WITH 100");

         statement.execute("CREATE TABLE data_bag (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))");
         statement.execute("CREATE TABLE data_bag_version (id INTEGER AUTO_INCREMENT PRIMARY KEY, data_bag_id INTEGER, sequence_no INTEGER, "
            + "commit_message VARCHAR(250), author VARCHAR(100), data TEXT, create_date TIMESTAMP)");
         statement.execute("INSERT INTO data_bag (id, name) VALUES (1, 'Owned data bag'), (2, 'Owned empty data bag')");
         statement.execute("INSERT INTO data_bag_version (id, data_bag_id, sequence_no, commit_message, author, data, create_date) VALUES "
            + "(1, 1, 1, 'Owned first version', 'Owned author', '{\"owned\":\"first\"}', TIMESTAMP '2026-01-02 03:04:05'), "
            + "(2, 1, 2, 'Owned second version', 'Owned author', '{\"owned\":\"second\",\"count\":2}', TIMESTAMP '2026-02-03 04:05:06')");

         ///////////////////////////////////////////////////////////////////////////////
         // saved reports (the sharing demo recreated these tables just before): one  //
         // owned by casey and shared read-only with alice, and alice's own filtered  //
         // pivot report over people                                                  //
         ///////////////////////////////////////////////////////////////////////////////
         statement.execute("INSERT INTO saved_report (id, label, table_name, user_id, query_filter_json, columns_json, pivot_table_json) VALUES "
            + "(101, 'Casey Shared People Report', 'person', 'sample:casey', '{}', '{\"columns\":[{\"name\":\"id\",\"isVisible\":true},{\"name\":\"firstName\",\"isVisible\":true}]}', NULL), "
            + "(102, 'Alice Filtered People Report', 'person', 'sample:alice', "
            + "'{\"criteria\":[{\"fieldName\":\"firstName\",\"operator\":\"STARTS_WITH\",\"values\":[\"A\"]},{\"fieldName\":\"annualSalary\",\"operator\":\"GREATER_THAN\",\"values\":[1000]}],\"orderBys\":[{\"fieldName\":\"lastName\",\"isAscending\":false}],\"booleanOperator\":\"AND\"}', "
            + "'{\"columns\":[{\"name\":\"id\",\"isVisible\":true},{\"name\":\"firstName\",\"isVisible\":true},{\"name\":\"email\",\"isVisible\":false},{\"name\":\"lastName\",\"isVisible\":true}]}', "
            + "'{\"rows\":[{\"fieldName\":\"lastName\"}],\"columns\":[{\"fieldName\":\"isEmployed\"}],\"values\":[{\"fieldName\":\"id\",\"function\":\"COUNT\"},{\"fieldName\":\"annualSalary\",\"function\":\"SUM\"}]}')");
         statement.execute("INSERT INTO shared_saved_report (saved_report_id, user_id, scope) VALUES (101, 'sample:alice', 'READ_ONLY')");
      }
      primeScripts();
   }



   /*******************************************************************************
    ** Scripts and scheduled reports live in the sample memory backend, which the
    ** database reset does not touch; replace only the owned script rows and clear
    ** the scheduled reports tests create, so every test starts without them.
    *******************************************************************************/
   private static void primeScripts() throws QException
   {
      QContext.init(instance, new QSystemUserSession());
      try
      {
         for(String table : List.of("scheduledReport", "scriptRevisionFile", "scriptRevision", "script", "scriptTypeFileSchema", "scriptType"))
         {
            new DeleteAction().execute(new DeleteInput(table).withQueryFilter(new QQueryFilter(new QFilterCriteria("id", QCriteriaOperator.IS_NOT_BLANK))));
         }
         new InsertAction().execute(new InsertInput("scriptType").withRecord(new QRecord().withValue("id", 1).withValue("name", "Owned script type")
            .withValue("fileMode", 1).withValue("helpText", "Owned script help").withValue("sampleCode", "return 'sample';")));
         new InsertAction().execute(new InsertInput("script").withRecord(new QRecord().withValue("id", 1).withValue("name", "Owned script")
            .withValue("scriptTypeId", 1).withValue("currentScriptRevisionId", 2)));
         new InsertAction().execute(new InsertInput("scriptRevision").withRecords(List.of(
            new QRecord().withValue("id", 1).withValue("scriptId", 1).withValue("sequenceNo", 1).withValue("commitMessage", "Owned first revision")
               .withValue("author", "Owned author").withValue("apiName", null),
            new QRecord().withValue("id", 2).withValue("scriptId", 1).withValue("sequenceNo", 2).withValue("commitMessage", "Owned second revision")
               .withValue("author", "Owned author"))));
         new InsertAction().execute(new InsertInput("scriptRevisionFile").withRecords(List.of(
            new QRecord().withValue("id", 1).withValue("scriptRevisionId", 1).withValue("fileName", "Script.js").withValue("contents", "return 'owned one';"),
            new QRecord().withValue("id", 2).withValue("scriptRevisionId", 2).withValue("fileName", "Script.js").withValue("contents", "return 'owned two';"))));
      }
      finally
      {
         QContext.clear();
      }
   }



   /*******************************************************************************
    ** Owned widget of every display type without a record context.
    *******************************************************************************/
   private static void defineGallery(QInstance qInstance)
   {
      List<String> widgets = new ArrayList<>();
      widgets.add(add(qInstance, widget("accAlert", WidgetType.ALERT, "Owned Alert").withGridColumns(6)));
      widgets.add(add(qInstance, widget("accAlertHidden", WidgetType.ALERT, "Hidden Alert").withGridColumns(6)));
      widgets.add(add(qInstance, widget("accDivider", WidgetType.DIVIDER, "Owned Divider").withGridColumns(12)));
      widgets.add(add(qInstance, widget("accFieldValueList", WidgetType.FIELD_VALUE_LIST, "Owned Field Values").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accHorizontalBarChart", WidgetType.HORIZONTAL_BAR_CHART, "Owned Horizontal Bars").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accMultiTable", WidgetType.MULTI_TABLE, "Owned Multi Table").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accLocation", WidgetType.LOCATION, "Owned Location").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accUsaMap", WidgetType.USA_MAP, "Owned Map").withGridColumns(8)));
      widgets.add(add(qInstance, widget("accCustomComponent", WidgetType.CUSTOM_COMPONENT, "Owned Custom Component").withGridColumns(4)
         .withDefaultValue("componentName", "OwnedComponent").withDefaultValue("componentSourceUrl", fakeBase + "/owned-extension.js")));
      widgets.add(add(qInstance, widget("accCustomComponentMissing", WidgetType.CUSTOM_COMPONENT, "Missing Custom Component").withGridColumns(4)
         .withDefaultValue("componentName", "MissingOwnedComponent").withDefaultValue("componentSourceUrl", fakeBase + "/missing-extension.js")));
      widgets.add(add(qInstance, widget("accGeneric", WidgetType.GENERIC, "Owned Generic").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accStatisticsGood", WidgetType.STATISTICS, "Owned Statistics").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accStackedBars", WidgetType.STACKED_BAR_CHART, "Owned Stacked Bars").withGridColumns(4)));
      qInstance.addApp(new QAppMetaData().withName(GALLERY_APP).withLabel("Widget Gallery").withIcon(new QIcon("widgets")).withWidgets(widgets));
   }



   /*******************************************************************************
    ** Header controls: dropdowns (stored and not), reload, export, help, icons.
    *******************************************************************************/
   private static void defineControls(QInstance qInstance)
   {
      add(qInstance, widget("accControlValues", WidgetType.HTML, "Selected Values"));
      ParentWidgetMetaData controls = new ParentWidgetMetaData().withChildWidgetNameList(List.of("accControlValues"));
      controls.withName("accControls").withType(WidgetType.PARENT_WIDGET.getType()).withLabel("Owned Controls")
         .withIsCard(true).withGridColumns(12).withTooltip("Owned widget help")
         .withShowReloadButton(true).withShowExportButton(true).withStoreDropdownSelections(true)
         .withDropdown(new WidgetDropdownData().withPossibleValueSourceName(CHOICE_PVS).withLabel("Choice").withIsRequired(true))
         .withDropdown(new WidgetDropdownData().withName("accDate").withLabel("Day").withType(WidgetDropdownType.DATE_PICKER).withIsRequired(true))
         .withCodeReference(new QCodeReference(OwnedRenderer.class));
      qInstance.addWidget(controls);

      add(qInstance, widget("accDropdownHtml", WidgetType.HTML, "Owned Dropdown").withGridColumns(6)
         .withDropdown(new WidgetDropdownData().withPossibleValueSourceName(CHOICE_PVS).withLabel("Choice")));
      add(qInstance, widget("accReload", WidgetType.HTML, "Owned Reload").withGridColumns(6).withShowReloadButton(true));
      add(qInstance, widget("accExport", WidgetType.HTML, "Owned Export").withGridColumns(6).withShowExportButton(true));
      add(qInstance, widget("accExportEmpty", WidgetType.HTML, "Owned Empty Export").withGridColumns(6).withShowExportButton(true));
      add(qInstance, widget("accHelp", WidgetType.HTML, "Owned Help").withGridColumns(6).withShowReloadButton(false)
         .withHelpContent("label", new QHelpContent("Owned help <b>content</b>").withFormat(HelpFormat.HTML)));
      add(qInstance, widget("accPlain", WidgetType.HTML, "Owned Plain Widget").withGridColumns(6).withIsCard(false)
         .withFooterHTML("Owned metadata footer"));
      qInstance.addApp(new QAppMetaData().withName(CONTROLS_APP).withLabel("Widget Controls").withIcon(new QIcon("tune"))
         .withWidgets(List.of("accControls", "accDropdownHtml", "accReload", "accExport", "accExportEmpty", "accHelp", "accPlain")));
   }



   /*******************************************************************************
    ** Empty, failing and malformed variants, each beside a healthy neighbor.
    *******************************************************************************/
   private static void defineStates(QInstance qInstance)
   {
      List<String> widgets = new ArrayList<>();
      widgets.add(add(qInstance, widget("accHealthy", WidgetType.HTML, "Healthy Neighbor").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accError", WidgetType.HTML, "Failing Widget").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyTable", WidgetType.TABLE, "Empty Table").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyTableDefault", WidgetType.TABLE, "Empty Table Default").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyMultiStatistics", WidgetType.MULTI_STATISTICS, "Empty Multi Statistics").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyBarChart", WidgetType.BAR_CHART, "Empty Bar Chart").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyLineChart", WidgetType.LINE_CHART, "Empty Line Chart").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyPieChart", WidgetType.PIE_CHART, "Empty Pie Chart").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyStepper", WidgetType.STEPPER, "Empty Stepper").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyStatistics", WidgetType.STATISTICS, "Empty Statistics").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyComposite", WidgetType.COMPOSITE, "Empty Composite").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyMultiTable", WidgetType.MULTI_TABLE, "Empty Multi Table").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyFieldValueList", WidgetType.FIELD_VALUE_LIST, "Empty Field Values").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyUsaMap", WidgetType.USA_MAP, "Empty Map").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyHtml", WidgetType.HTML, "Empty Html").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accEmptyAlert", WidgetType.ALERT, "Empty Alert").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accMalformedChart", WidgetType.BAR_CHART, "Malformed Chart").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accMalformedTable", WidgetType.TABLE, "Malformed Table").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accMalformedComposite", WidgetType.COMPOSITE, "Malformed Composite").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accMalformedStepper", WidgetType.STEPPER, "Malformed Stepper").withGridColumns(4)));
      widgets.add(add(qInstance, widget("accMalformedMultiStatistics", WidgetType.MULTI_STATISTICS, "Malformed Multi Statistics").withGridColumns(4)));
      qInstance.addApp(new QAppMetaData().withName(STATES_APP).withLabel("Widget States").withIcon(new QIcon("report_problem")).withWidgets(widgets));
   }



   /*******************************************************************************
    ** Parent widgets in grid and tab layouts, with denied and missing children.
    *******************************************************************************/
   private static void defineParents(QInstance qInstance)
   {
      add(qInstance, widget("accChildA", WidgetType.HTML, "Child A").withGridColumns(6));
      add(qInstance, widget("accChildB", WidgetType.HTML, "Child B").withGridColumns(6));
      add(qInstance, widget("accChildDenied", WidgetType.HTML, "Denied Child").withGridColumns(6)
         .withPermissionRules(new QPermissionRules().withLevel(PermissionLevel.HAS_ACCESS_PERMISSION).withPermissionBaseName("pet.accChildDenied")));
      qInstance.addWidget(parent("accParentGrid", "Owned Parent Grid", ParentWidgetMetaData.LayoutType.GRID, List.of("accChildA", "accChildB")));
      qInstance.addWidget(parent("accParentTabs", "Owned Parent Tabs", ParentWidgetMetaData.LayoutType.TABS, List.of("accChildA", "accChildB")));
      qInstance.addWidget(parent("accParentDenied", "Owned Parent Denied Child", ParentWidgetMetaData.LayoutType.GRID, List.of("accChildDenied", "accChildA")));
      qInstance.addWidget(parent("accParentMissing", "Owned Parent Missing Child", ParentWidgetMetaData.LayoutType.GRID, List.of("accChildB")));
      qInstance.addApp(new QAppMetaData().withName(PARENTS_APP).withLabel("Widget Parents").withIcon(new QIcon("account_tree"))
         .withWidgets(List.of("accParentGrid", "accParentTabs", "accParentDenied", "accParentMissing")));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static ParentWidgetMetaData parent(String name, String label, ParentWidgetMetaData.LayoutType layout, List<String> children)
   {
      ParentWidgetMetaData parent = new ParentWidgetMetaData().withChildWidgetNameList(children).withLayoutType(layout);
      parent.withName(name).withType(WidgetType.PARENT_WIDGET.getType()).withLabel(label).withIsCard(true).withGridColumns(12)
         .withCodeReference(new QCodeReference(OwnedRenderer.class));
      return (parent);
   }



   /*******************************************************************************
    ** Composite widgets with every block type and layout.
    *******************************************************************************/
   private static void defineBlocks(QInstance qInstance)
   {
      add(qInstance, widget("accBlocks", WidgetType.COMPOSITE, "Owned Blocks").withGridColumns(12));
      add(qInstance, widget("accBlocksUnknown", WidgetType.COMPOSITE, "Owned Unknown Block").withGridColumns(6));
      qInstance.addApp(new QAppMetaData().withName(BLOCKS_APP).withLabel("Widget Blocks").withIcon(new QIcon("view_quilt"))
         .withWidgets(List.of("accBlocks", "accBlocksUnknown", "accHealthy")));
   }



   /*******************************************************************************
    ** A widget that houses the sample's interactive greeting process.
    *******************************************************************************/
   private static void defineProcessWidget(QInstance qInstance)
   {
      qInstance.addWidget(new QWidgetMetaData().withName("accProcess").withType(WidgetType.PROCESS.getType()).withLabel("Owned Process Widget")
         .withIsCard(true).withGridColumns(8).withDefaultValue(ProcessWidgetRenderer.WIDGET_PROCESS_NAME, "greetInteractive")
         .withCodeReference(new QCodeReference(ProcessWidgetRenderer.class)));
      qInstance.addApp(new QAppMetaData().withName(PROCESS_APP).withLabel("Widget Process").withIcon(new QIcon("play_circle"))
         .withWidgets(List.of("accProcess", "accHealthy")));
   }



   /*******************************************************************************
    ** A widget whose permission is outside the noPets persona's grants.
    *******************************************************************************/
   private static void definePermissions(QInstance qInstance)
   {
      add(qInstance, widget("accDenied", WidgetType.HTML, "Owned Restricted Widget").withGridColumns(6)
         .withPermissionRules(new QPermissionRules().withLevel(PermissionLevel.HAS_ACCESS_PERMISSION).withPermissionBaseName("pet.accDenied")));
      qInstance.addApp(new QAppMetaData().withName(PERMISSIONS_APP).withLabel("Widget Permissions").withIcon(new QIcon("lock"))
         .withWidgets(List.of("accDenied", "accHealthy")));
   }



   /*******************************************************************************
    ** Record-view widgets: a host table with widget sections, data bags, scripts.
    *******************************************************************************/
   private static void defineRecordWidgets(QInstance qInstance) throws QException
   {
      QTableMetaData host = rdbms(new QTableMetaData().withName(HOST_TABLE).withLabel("Widget Host").withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("owner", QFieldType.STRING))
         .withField(new QFieldMetaData("zero", QFieldType.INTEGER))
         .withField(new QFieldMetaData("cronExpression", QFieldType.STRING).withLabel("Schedule Expression"))
         .withField(new QFieldMetaData("cronTimeZoneId", QFieldType.STRING).withLabel("Time Zone"))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name", "owner", "zero")))
         .withSection(new QFieldSection().withName("hostSchedule").withLabel("Owned Schedule").withTier(Tier.T2).withWidgetName("accHostCron"))
         .withSection(new QFieldSection().withName("hostFieldValues").withLabel("Owned Record Values").withTier(Tier.T2).withWidgetName("accHostFieldValues"))
         .withSection(new QFieldSection().withName("hostHtml").withLabel("Owned Record Html").withTier(Tier.T2).withWidgetName("accHostHtml"))
         .withSection(new QFieldSection().withName("hostDynamicForm").withLabel("Owned Dynamic Form").withTier(Tier.T2).withWidgetName("accHostDynamicForm"))
         .withSection(new QFieldSection().withName("hostChildren").withLabel("Owned Children").withTier(Tier.T2).withWidgetName(HOST_CHILD_JOIN))
         .withSection(new QFieldSection().withName("hostRows").withLabel("Owned Rows").withTier(Tier.T2).withWidgetName("accHostRows"))
         .withSection(new QFieldSection("hostHidden", "Hidden", new QIcon("visibility_off"), Tier.T2, List.of("cronExpression", "cronTimeZoneId")).withIsHidden(true)));
      qInstance.addTable(host);

      QTableMetaData child = rdbms(new QTableMetaData().withName(HOST_CHILD_TABLE).withLabel("Widget Host Child").withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("hostId", QFieldType.INTEGER).withLabel("Host").withPossibleValueSourceName(HOST_TABLE))
         .withField(new QFieldMetaData("name", QFieldType.STRING)));
      qInstance.addTable(child);
      qInstance.addPossibleValueSource(QPossibleValueSource.newForTable(HOST_TABLE));
      QJoinMetaData join = new QJoinMetaData().withName(HOST_CHILD_JOIN).withLeftTable(HOST_TABLE).withRightTable(HOST_CHILD_TABLE)
         .withType(JoinType.ONE_TO_MANY).withJoinOn(new JoinOn("id", "hostId"));
      qInstance.addJoin(join);
      qInstance.addWidget(ChildRecordListRenderer.widgetMetaDataBuilder(join).withLabel("Owned Children").withMaxRows(2)
         .withOrderBys(List.of(new QFilterOrderBy("id"))).getWidgetMetaData());

      qInstance.addWidget(CronUIWidgetRenderer.buildWidgetMetaData("accHostCron", "Owned Schedule",
         new CronUISetupData().withTableName(HOST_TABLE).withCronExpressionFieldName("cronExpression").withTimeZoneFieldName("cronTimeZoneId")));
      add(qInstance, widget("accHostFieldValues", WidgetType.FIELD_VALUE_LIST, "Owned Record Values"));
      add(qInstance, widget("accHostHtml", WidgetType.HTML, "Owned Record Html"));
      add(qInstance, widget("accHostDynamicForm", WidgetType.DYNAMIC_FORM, "Owned Dynamic Form"));
      add(qInstance, widget("accHostRows", WidgetType.ROW_BUILDER, "Owned Rows")
         .withDefaultValue("fields", new ArrayList<>(List.of(new QFieldMetaData("name", QFieldType.STRING).withLabel("Row Name"),
            new QFieldMetaData("quantity", QFieldType.INTEGER).withLabel("Row Quantity")))));

      QTableMetaData dataBag = rdbms(new QTableMetaData().withName(DATA_BAG_TABLE).withLabel("Data Bag").withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name")))
         .withSection(new QFieldSection().withName("contents").withLabel("Contents").withTier(Tier.T2).withWidgetName("accDataBagViewer")));
      qInstance.addTable(dataBag);
      qInstance.addTable(rdbms(new QTableMetaData().withName(DATA_BAG_VERSION).withLabel("Data Bag Version").withPrimaryKeyField("id")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("dataBagId", QFieldType.INTEGER))
         .withField(new QFieldMetaData("sequenceNo", QFieldType.INTEGER))
         .withField(new QFieldMetaData("commitMessage", QFieldType.STRING))
         .withField(new QFieldMetaData("author", QFieldType.STRING))
         .withField(new QFieldMetaData("data", QFieldType.TEXT))
         .withField(new QFieldMetaData("createDate", QFieldType.DATE_TIME))));
      qInstance.addWidget(new QWidgetMetaData().withName("accDataBagViewer").withType(WidgetType.DATA_BAG_VIEWER.getType()).withLabel("Data Bag Contents")
         .withIsCard(true).withCodeReference(new QCodeReference(DefaultWidgetRenderer.class)));

      ////////////////////////////////////////////////////////////////////////
      // the scripts provider registers the same tables possible-value      //
      // source the sharing demo already added; let it register its own.   //
      ////////////////////////////////////////////////////////////////////////
      qInstance.getPossibleValueSources().remove("tables");
      new ScriptsMetaDataProvider().defineAll(qInstance, SampleMetaDataProvider.MEMORY_BACKEND_NAME, null);

      qInstance.addApp(new QAppMetaData().withName(RECORDS_APP).withLabel("Widget Records").withIcon(new QIcon("table_view"))
         .withChild(host).withChild(child).withChild(dataBag).withChild(qInstance.getTable("script")));
   }



   /*******************************************************************************
    ** Reports of each type, run through the basic report process.
    *******************************************************************************/
   private static void defineReports(QInstance qInstance)
   {
      ////////////////////////////////////////////////////////////////////////////
      // the basic report process is hidden, so it has no grantable permission  //
      // of its own; as QQQ intends, its permission is the named report's own   //
      // permission (ReportProcessPermissionChecker).                           //
      ////////////////////////////////////////////////////////////////////////////
      qInstance.addProcess(BasicRunReportProcess.defineProcessMetaData()
         .withPermissionRules(QPermissionRules.defaultInstance().withCustomPermissionChecker(new QCodeReference(ReportProcessPermissionChecker.class))));
      String process = BasicRunReportProcess.PROCESS_NAME;

      QReportMetaData table = new QReportMetaData().withName("accPersonReport").withLabel("Owned Person Report").withProcessName(process)
         .withDataSource(new QReportDataSource().withName("people").withSourceTable("person")
            .withQueryFilter(new QQueryFilter().withOrderBy(new QFilterOrderBy("id"))))
         .withView(new QReportView().withName("people").withLabel("People").withDataSourceName("people").withType(ReportType.TABLE)
            .withColumns(List.of(new QReportField("id").withLabel("Id"), new QReportField("firstName").withLabel("First Name"),
               new QReportField("lastName").withLabel("Last Name"), new QReportField("email").withLabel("Email"))));

      QReportMetaData summary = new QReportMetaData().withName("accPetSummaryReport").withLabel("Owned Pet Summary Report").withProcessName(process)
         .withDataSource(new QReportDataSource().withName("pets").withSourceTable("pet"))
         .withView(new QReportView().withName("summary").withLabel("Pets Per Owner").withDataSourceName("pets").withType(ReportType.SUMMARY)
            .withSummaryFields(List.of("personId")).withIncludeTotalRow(true)
            .withOrderByFields(List.of(new QFilterOrderBy("personId")))
            .withColumns(List.of(new QReportField().withName("petCount").withLabel("Pet Count").withFormula("${pivot.count.id}"))));

      QReportMetaData pivot = new QReportMetaData().withName("accPetPivotReport").withLabel("Owned Pet Pivot Report").withProcessName(process)
         .withDataSource(new QReportDataSource().withName("pets").withSourceTable("pet").withQueryFilter(new QQueryFilter().withOrderBy(new QFilterOrderBy("id"))))
         .withView(new QReportView().withName("petRows").withLabel("Pet Rows").withDataSourceName("pets").withType(ReportType.TABLE)
            .withColumns(List.of(new QReportField("id").withLabel("Id"), new QReportField("name").withLabel("Name"),
               new QReportField("speciesId").withLabel("Species"), new QReportField("personId").withLabel("Owner"))))
         .withView(new QReportView().withName("petPivot").withLabel("Pets By Owner").withDataSourceName("pets").withType(ReportType.PIVOT)
            .withPivotTableSourceViewName("petRows")
            //////////////////////////////////////////////////////////////////////////
            // instance validation demands columns or a view customizer even for a  //
            // PIVOT view, whose columns generation cannot resolve (#484); a no-op  //
            // customizer satisfies validation without columns                      //
            //////////////////////////////////////////////////////////////////////////
            .withViewCustomizer(new QCodeReference(UnchangedView.class))
            .withPivotTableDefinition(new PivotTableDefinition()
               .withRow(new PivotTableGroupBy().withFieldName("personId"))
               .withValue(new PivotTableValue().withFunction(PivotTableFunction.COUNT).withFieldName("id"))));

      QReportMetaData input = new QReportMetaData().withName("accPersonInputReport").withLabel("Owned Person Input Report").withProcessName(process)
         .withInputField(new QFieldMetaData("minimumId", QFieldType.INTEGER).withLabel("Minimum Id").withIsRequired(true))
         .withDataSource(new QReportDataSource().withName("people").withSourceTable("person")
            .withQueryFilter(new QQueryFilter(new QFilterCriteria("id", QCriteriaOperator.GREATER_THAN_OR_EQUALS, List.of("${input.minimumId}")))
               .withOrderBy(new QFilterOrderBy("id"))))
         .withView(new QReportView().withName("people").withLabel("People").withDataSourceName("people").withType(ReportType.TABLE)
            .withColumns(List.of(new QReportField("id").withLabel("Id"), new QReportField("firstName").withLabel("First Name"))));

      QReportMetaData denied = new QReportMetaData().withName("accRestrictedReport").withLabel("Owned Restricted Report").withProcessName(process)
         .withPermissionRules(new QPermissionRules().withLevel(PermissionLevel.HAS_ACCESS_PERMISSION).withPermissionBaseName("pet.accRestrictedReport"))
         .withDataSource(new QReportDataSource().withName("people").withSourceTable("person"))
         .withView(new QReportView().withName("people").withDataSourceName("people").withType(ReportType.TABLE)
            .withColumns(List.of(new QReportField("id").withLabel("Id"), new QReportField("firstName").withLabel("First Name"))));

      /////////////////////////////////////////////////////////////////
      // no process: served by the streaming GET /reports/{name} route //
      /////////////////////////////////////////////////////////////////
      QReportMetaData streamed = new QReportMetaData().withName("accStreamedReport").withLabel("Owned Streamed Report")
         .withDataSource(new QReportDataSource().withName("pets").withSourceTable("pet").withQueryFilter(new QQueryFilter().withOrderBy(new QFilterOrderBy("id"))))
         .withView(new QReportView().withName("pets").withDataSourceName("pets").withType(ReportType.TABLE)
            .withColumns(List.of(new QReportField("id").withLabel("Id"), new QReportField("name").withLabel("Name"))));

      QAppMetaData app = new QAppMetaData().withName(REPORTS_APP).withLabel("Acceptance Reports").withIcon(new QIcon("assessment"));
      for(QReportMetaData report : List.of(table, summary, pivot, input, denied, streamed))
      {
         qInstance.addReport(report);
         app.withChild(report);
      }
      qInstance.addApp(app);
   }



   /*******************************************************************************
    ** Content-Security-Policy override (the application hook, QRun-IO/qqq#695):
    ** the loopback service stands in for QuickSight (frame-src) and serves the
    ** image and audio blocks (img-src, media-src). The custom component bundle
    ** needs nothing here: the dashboard allows each customComponent widget's
    ** componentSourceUrl origin itself.
    *******************************************************************************/
   static void allowFakeService(NextDashboardSecurityHeaders headers)
   {
      if(fakeBase != null)
      {
         headers.withSources("frame-src", fakeBase).withSources("img-src", fakeBase).withSources("media-src", fakeBase);
      }
   }



   /*******************************************************************************
    ** The sample's QuickSight widget needs an AWS account; point its real
    ** renderer at the owned loopback protocol endpoint instead.
    *******************************************************************************/
   private static void repointSampleQuickSight(QInstance qInstance)
   {
      QuickSightChartMetaData quickSight = (QuickSightChartMetaData) qInstance.getWidget("QuickSightChartRenderer");
      quickSight.withAccountId("000000000000").withAccessKey("owned-fixture-access").withSecretKey("owned-fixture-secret-not-a-credential")
         .withUserArn("arn:aws:quicksight:us-east-1:000000000000:user/default/owned-user").withDashboardId("owned-dashboard").withRegion("us-east-1");
      quickSight.withType(WidgetType.QUICK_SIGHT_CHART.getType());
      System.setProperty("aws.endpointUrl", fakeBase);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QTableMetaData rdbms(QTableMetaData table)
   {
      table.setBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME);
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
      QInstanceEnricher.setInferredFieldBackendNames(table);
      return (table);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QWidgetMetaData widget(String name, WidgetType type, String label)
   {
      return (new QWidgetMetaData().withName(name).withType(type.getType()).withLabel(label).withIsCard(true)
         .withCodeReference(new QCodeReference(OwnedRenderer.class)));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static String add(QInstance qInstance, QWidgetMetaData widget)
   {
      qInstance.addWidget(widget);
      return (widget.getName());
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   static int renders(String widgetName)
   {
      return (RENDERS.computeIfAbsent(widgetName, n -> new AtomicInteger()).incrementAndGet());
   }



   /*******************************************************************************
    ** Loopback-only fake service; serves the QuickSight embed-url protocol,
    ** the embeddable page, a component bundle, an image and an audio clip.
    *******************************************************************************/
   private static synchronized void startFakeService() throws QException
   {
      if(fakeService != null)
      {
         return;
      }
      try
      {
         HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
         byte[] png   = png();
         byte[] audio = wav();
         server.createContext("/", exchange ->
         {
            String path = exchange.getRequestURI().getPath();
            exchange.getRequestBody().readAllBytes();
            if("POST".equals(exchange.getRequestMethod()) && path.matches("/accounts/[^/]+/embed-url/registered-user"))
            {
               respond(exchange, 200, "application/json", ("{\"EmbedUrl\":\"" + fakeBase + "/owned-embed.html\",\"Status\":200,\"RequestId\":\"owned\"}").getBytes(StandardCharsets.UTF_8));
            }
            else if(path.equals("/owned-embed.html"))
            {
               respond(exchange, 200, "text/html; charset=utf-8", "<!doctype html><html><head><title>Owned embed</title></head><body><h1>Owned embedded chart</h1><p>42 units</p></body></html>".getBytes(StandardCharsets.UTF_8));
            }
            else if(path.equals("/owned-extension.js"))
            {
               respond(exchange, 200, "application/javascript", ("window.OwnedComponent={OwnedComponent:function(args){var p=args.props;"
                  + "return 'Loaded component: '+p.widgetMetaData.label+' / '+String(p.widgetData.footerHTML==null?'empty':p.widgetData.footerHTML);}};").getBytes(StandardCharsets.UTF_8));
            }
            else if(path.equals("/owned-image.png"))
            {
               respond(exchange, 200, "image/png", png);
            }
            else if(path.equals("/owned-audio.wav"))
            {
               respond(exchange, 200, "audio/wav", audio);
            }
            else
            {
               respond(exchange, 404, "text/plain", "not found".getBytes(StandardCharsets.UTF_8));
            }
         });
         server.start();
         fakeService = server;
         fakeBase = "http://127.0.0.1:" + server.getAddress().getPort();
         Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0)));
      }
      catch(IOException e)
      {
         throw (new QException("Could not start the owned fake service", e));
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void respond(HttpExchange exchange, int status, String contentType, byte[] body) throws IOException
   {
      exchange.getResponseHeaders().add("Content-Type", contentType);
      exchange.getResponseHeaders().add("Cache-Control", "no-store");
      exchange.sendResponseHeaders(status, body.length);
      exchange.getResponseBody().write(body);
      exchange.close();
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static byte[] png() throws IOException
   {
      BufferedImage image = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
      for(int x = 0; x < 8; x++)
      {
         for(int y = 0; y < 8; y++)
         {
            image.setRGB(x, y, 0x8F00D8);
         }
      }
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      ImageIO.write(image, "png", output);
      return (output.toByteArray());
   }



   /*******************************************************************************
    ** A tenth of a second of silence, 8 kHz mono 8-bit PCM.
    *******************************************************************************/
   private static byte[] wav()
   {
      int samples = 800;
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      writeAscii(output, "RIFF");
      writeInt(output, 36 + samples);
      writeAscii(output, "WAVEfmt ");
      writeInt(output, 16);
      writeShort(output, 1);
      writeShort(output, 1);
      writeInt(output, 8000);
      writeInt(output, 8000);
      writeShort(output, 1);
      writeShort(output, 8);
      writeAscii(output, "data");
      writeInt(output, samples);
      for(int i = 0; i < samples; i++)
      {
         output.write(128);
      }
      return (output.toByteArray());
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void writeAscii(ByteArrayOutputStream output, String text)
   {
      output.writeBytes(text.getBytes(StandardCharsets.US_ASCII));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void writeInt(ByteArrayOutputStream output, int value)
   {
      output.write(value & 0xFF);
      output.write((value >> 8) & 0xFF);
      output.write((value >> 16) & 0xFF);
      output.write((value >> 24) & 0xFF);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void writeShort(ByteArrayOutputStream output, int value)
   {
      output.write(value & 0xFF);
      output.write((value >> 8) & 0xFF);
   }



   /*******************************************************************************
    ** A report view customizer that leaves the view unchanged (see #484).
    *******************************************************************************/
   public static class UnchangedView implements Function<QReportView, QReportView>
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public QReportView apply(QReportView view)
      {
         return (view);
      }
   }



   /*******************************************************************************
    ** Base shape for owned payloads the stock data classes do not model.
    *******************************************************************************/
   public static class OwnedData extends QWidgetData
   {
      private final String                    type;
      private final Map<String, Serializable> values = new LinkedHashMap<>();



      /*******************************************************************************
       **
       *******************************************************************************/
      public OwnedData(String type)
      {
         this.type = type;
      }



      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public String getType()
      {
         return (type);
      }



      /*******************************************************************************
       **
       *******************************************************************************/
      public OwnedData with(String key, Serializable value)
      {
         values.put(key, value);
         return (this);
      }



      /*******************************************************************************
       **
       *******************************************************************************/
      @JsonAnyGetter
      public Map<String, Serializable> getValues()
      {
         return (values);
      }
   }



   /*******************************************************************************
    ** Fixed, owned display values for each owned widget.
    *******************************************************************************/
   public static class OwnedRenderer extends AbstractWidgetRenderer
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input) throws QException
      {
         String name  = input.getWidgetMetaData().getName();
         int    count = renders(name);
         Map<String, String> params = input.getQueryParams() == null ? Map.of() : input.getQueryParams();
         QWidgetData data = switch(name)
         {
            case "accAlert" -> new AlertData(AlertData.AlertType.WARNING, "<strong>Owned warning</strong>").withBulletList(List.of("<em>Owned bullet</em>", "Second owned bullet"));
            case "accAlertHidden" -> new AlertData(AlertData.AlertType.ERROR, "Hidden owned alert").withHideWidget(true);
            case "accDivider" -> new DividerWidgetData();
            case "accFieldValueList" -> fieldValues();
            case "accHorizontalBarChart" -> new ChartData("Owned horizontal", "Owned <b>data</b>", "Owned series", List.of("First", "Zero", "Negative"), List.of(5, 0, -2)).withHeight(240);
            case "accMultiTable" -> new MultiTableData(List.of(simpleTable("First", "First owned row"), simpleTable("Second", "Second owned row")));
            case "accLocation" -> new LocationData(fakeBase + "/owned-image.png", "Owned location", "Owned description", "Owned address", "Owned footer");
            case "accUsaMap" -> new USMapWidgetData().withHeight("300px").withMapMarkerList(List.of(
               new USMapWidgetData.MapMarker("Owned Chicago", new BigDecimal("41.8781"), new BigDecimal("-87.6298")),
               new USMapWidgetData.MapMarker("Owned Denver", new BigDecimal("39.7392"), new BigDecimal("-104.9903")),
               new USMapWidgetData.MapMarker("Owned Boston", new BigDecimal("42.3601"), new BigDecimal("-71.0589"))));
            case "accCustomComponent", "accCustomComponentMissing" -> new OwnedData("customComponent").withFooterHTML("Owned component value");
            case "accGeneric" -> new OwnedData("generic").withSublabel("Owned sublabel").withFooterHTML("<b>Owned footer</b>");
            case "accStatisticsGood" -> new StatisticsData(1234, new BigDecimal("12.5"), "vs owned period").withCountContext("owned units")
               .withCountURL("/app/person").withIsCurrency(false).withIncreaseIsGood(false);
            case "accStackedBars" -> stackedBars();
            case "accControls" -> parentData(input);
            case "accControlValues" -> new RawHTML("Owned Controls", "choice=" + params.getOrDefault(CHOICE_PVS, "") + "; day=" + params.getOrDefault("accDate", "") + "; renders=" + count)
               .withCsvData(csv());
            case "accDropdownHtml" ->
            {
               RawHTML html = new RawHTML("Owned Dropdown", "dropdown choice=" + params.getOrDefault(CHOICE_PVS, "(none)"));
               setupDropdowns(input, (QWidgetMetaData) input.getWidgetMetaData(), html);
               yield (html);
            }
            case "accReload" -> new RawHTML("Owned Reload", "reload renders=" + count);
            case "accExport" -> new RawHTML("Owned Export", "export ready").withCsvData(csv());
            case "accExportEmpty" -> new RawHTML("Owned Empty Export", "nothing to export");
            case "accHelp" -> new RawHTML("Owned Help", "help widget body");
            case "accPlain" -> new RawHTML("Owned Plain", "plain widget body");
            case "accHealthy" -> new RawHTML("Healthy", "Healthy neighbor content");
            case "accError" -> throw (new QException("Owned widget renderer failure"));
            case "accEmptyTable" -> new TableData(null, List.of(new TableData.Column("default", "Name", "name", "1fr", null)), List.of()).withNoRowsFoundHTML("No owned rows");
            case "accEmptyTableDefault" -> new TableData(null, List.of(new TableData.Column("default", "Name", "name", "1fr", null)), List.of());
            case "accEmptyMultiStatistics" -> new MultiStatisticsData("Empty owned statistics", List.of());
            case "accEmptyBarChart", "accEmptyLineChart", "accEmptyPieChart" -> new ChartData("Empty owned chart", null, "Owned series", List.of(), List.of());
            case "accEmptyStepper" -> new StepperData("Empty owned stepper", 0, List.of());
            case "accEmptyStatistics" -> new StatisticsData(0, 0, "vs nothing");
            case "accEmptyComposite" -> new CompositeWidgetData();
            case "accEmptyMultiTable" -> new MultiTableData(List.of());
            case "accEmptyFieldValueList" -> new FieldValueListData(List.of(), new QRecord());
            case "accEmptyUsaMap" -> new USMapWidgetData().withHeight("200px").withMapMarkerList(List.of());
            case "accEmptyHtml" -> new RawHTML("Empty", "");
            case "accEmptyAlert" -> new AlertData();
            case "accMalformedChart" -> new OwnedData("chart").with("chartData", malformed());
            case "accMalformedTable" -> new OwnedData("table").with("rows", malformed()).with("columns", malformed());
            case "accMalformedComposite" -> new OwnedData("composite").with("blocks", malformed());
            case "accMalformedStepper" -> new OwnedData("stepper").with("steps", malformed());
            case "accMalformedMultiStatistics" -> new OwnedData("multiStatistics").with("statisticsGroupData", malformed());
            case "accChildA" -> new RawHTML("Child A", "Child A content; choice=" + params.getOrDefault(CHOICE_PVS, ""));
            case "accChildB" -> new RawHTML("Child B", "Child B content");
            case "accChildDenied" -> new RawHTML("Denied Child", "Denied child content; renders=" + count);
            case "accParentGrid", "accParentTabs", "accParentDenied" -> new ParentWidgetRenderer().render(input).getWidgetData();
            case "accParentMissing" ->
            {
               ParentWidgetData parent = (ParentWidgetData) new ParentWidgetRenderer().render(input).getWidgetData();
               parent.setChildWidgetNameList(List.of("accNoSuchWidget", "accChildB"));
               yield (parent);
            }
            case "accBlocks" -> allBlocks();
            case "accBlocksUnknown" -> new CompositeWidgetData().withBlock(new BigNumberBlockData()
            {
               /*******************************************************************************
                **
                *******************************************************************************/
               @Override
               public String getBlockTypeName()
               {
                  return ("OWNED_UNKNOWN");
               }
            }.withValues(new BigNumberValues().withNumber("9")));
            case "accDenied" -> new RawHTML("Restricted", "Restricted widget content; renders=" + count);
            case "accHostFieldValues" -> hostFieldValues(input, params);
            case "accHostHtml" -> new RawHTML("Owned Record Html", "Host record " + params.getOrDefault("id", "(none)") + " in " + params.getOrDefault("tableName", "(none)"));
            case "accHostDynamicForm" -> hostDynamicForm(input, params);
            case "accHostRows" -> new RowBuilderData(new ArrayList<>(List.of(new QRecord().withValue("name", "Owned row one").withValue("quantity", 3),
               new QRecord().withValue("name", "Owned row two").withValue("quantity", 0))));
            default -> throw (new QException("Unexpected owned widget " + name));
         };
         return (new RenderWidgetOutput(data));
      }



      /*******************************************************************************
       **
       *******************************************************************************/
      private QWidgetData parentData(RenderWidgetInput input) throws QException
      {
         QWidgetData data = new ParentWidgetRenderer().render(input).getWidgetData();
         data.setCsvData(csv());
         return (data);
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static List<List<Serializable>> csv()
   {
      return (new ArrayList<>(List.of(new ArrayList<>(List.of("Label", "Value")), new ArrayList<>(List.of("A,\"B\"", 7)), new ArrayList<>(List.of("Beta", 0)))));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static LinkedHashMap<String, Serializable> malformed()
   {
      LinkedHashMap<String, Serializable> map = new LinkedHashMap<>();
      map.put("invalidShape", true);
      return (map);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static FieldValueListData fieldValues()
   {
      FieldValueListData fields = new FieldValueListData();
      fields.addFieldWithValue("owner", QFieldType.STRING, "Alice").withLabel("Owner");
      fields.addFieldWithValue("zero", QFieldType.INTEGER, 0).withLabel("Zero");
      fields.addFieldWithValue("choice", QFieldType.INTEGER, 1, "Owned choice").withLabel("Choice");
      fields.setFieldLabelPrefixIconAndColor("owner", "person", "#8F00D8");
      fields.setFieldIndentLevel("zero", 1);
      return (fields);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static ChartData stackedBars()
   {
      return (new ChartData()
         .withChartData(new ChartData.Data()
            .withLabels(List.of("North", "South"))
            .withDatasets(List.of(
               new ChartData.Data.Dataset().withLabel("Owned first").withData(List.of(3, 4)).withColor("#FF0000"),
               new ChartData.Data.Dataset().withLabel("Owned second").withData(List.of(5, 1)).withColor("#0000FF")))));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static TableData simpleTable(String label, String value)
   {
      return (new TableData(label, List.of(new TableData.Column("default", "Name", "name", "100%", "left")), List.of(Map.of("name", value))));
   }



   /*******************************************************************************
    ** Values read from the host record with the caller's own read permission.
    *******************************************************************************/
   private static QWidgetData hostFieldValues(RenderWidgetInput input, Map<String, String> params) throws QException
   {
      QRecord record = readHost(input, params);
      FieldValueListData fields = new FieldValueListData();
      fields.addFieldWithValue("owner", QFieldType.STRING, record.getValueString("owner")).withLabel("Owner");
      fields.addFieldWithValue("zero", QFieldType.INTEGER, record.getValueInteger("zero")).withLabel("Zero");
      return (fields);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QWidgetData hostDynamicForm(RenderWidgetInput input, Map<String, String> params) throws QException
   {
      QRecord record = readHost(input, params);
      return (new DynamicFormWidgetData()
         .withFieldList(List.of(new QFieldMetaData("owner", QFieldType.STRING).withLabel("Owner"), new QFieldMetaData("zero", QFieldType.INTEGER).withLabel("Zero")))
         .withRecordOfFieldValues(new QRecord().withValue("owner", record.getValue("owner")).withValue("zero", record.getValue("zero")))
         .withNoFieldsMessage("No owned fields"));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QRecord readHost(RenderWidgetInput input, Map<String, String> params) throws QException
   {
      GetInput get = new GetInput(HOST_TABLE).withPrimaryKey(params.get("id"));
      get.setInputSource(input.getInputSource());
      PermissionsHelper.checkTablePermissionThrowing(get, TablePermissionSubType.READ);
      QRecord record = new GetAction().executeForRecord(get);
      if(record == null)
      {
         throw (new QException("Owned host record not found"));
      }
      return (record);
   }



   /*******************************************************************************
    ** Every canonical block type, arranged in every composite layout.
    *******************************************************************************/
   private static CompositeWidgetData allBlocks()
   {
      CompositeWidgetData data = new CompositeWidgetData();
      data.setLayout(CompositeWidgetData.Layout.FLEX_COLUMN);
      data.addBlock(new TextBlockData().withBlockId("ownedText").withValues(new TextValues().withText("Owned text line one\nOwned text line two"))
         .withStyles(new TextStyles().withColor("SUCCESS").withFormat("alert").withSize("title").withWeight("bold")));
      data.addBlock(new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.FLEX_ROW)
         .withBlock(new BigNumberBlockData().withLink("/app/person").withTooltip("Owned big number tooltip")
            .withValues(new BigNumberValues().withHeading("Owned heading").withNumber("4,321").withContext("owned context"))
            .withStyles(new BigNumberStyles().withNumberColor("#8F00D8")))
         .withBlock(new UpOrDownNumberBlockData().withValues(new UpOrDownNumberValues().withIsUp(true).withIsGood(false).withNumber("17%").withContext("owned change"))));
      data.addBlock(new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.BADGES_WRAPPER)
         .withBlock(new NumberIconBadgeBlockData().withValues(new NumberIconBadgeValues().withNumber(12).withIconName("inventory")).withStyles(new NumberIconBadgeStyles().withColor("#2BA83F")))
         .withBlock(new IconBlockData().withValues(new IconValues().withName("star")).withStyles(new IconStyles().withColor("#FF8000").withFontSize("24px"))));
      data.addBlock(new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.TABLE_SUB_ROW_DETAILS)
         .withBlock(new TableSubRowDetailRowBlockData().withValues(new TableSubRowDetailRowValues().withLabel("Owned detail label").withValue("Owned detail value"))
            .withStyles(new TableSubRowDetailRowStyles().withLabelColor("#546E7A").withValueColor("#0062FF"))));
      data.addBlock(new ProgressBarBlockData().withValues(new ProgressBarValues().withHeading("Owned progress").withPercent(new BigDecimal("62.5")))
         .withStyles(new ProgressBarStyles().withBarColor("#10B8A6")));
      data.addBlock(new DividerBlockData());
      data.addBlock(new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.FLEX_ROW_SPACE_BETWEEN)
         .withBlock(new TextBlockData().withValues(new TextValues().withText("Owned left")))
         .withBlock(new TextBlockData().withValues(new TextValues().withText("Owned right"))));
      data.addBlock(new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.FLEX_ROW_CENTER)
         .withBlock(new ImageBlockData().withValues(new ImageValues().withPath(fakeBase + "/owned-image.png").withAlt("Owned image")).withStyles(new ImageStyles().withWidth("32px").withHeight("32px")))
         .withBlock(new AudioBlockData().withValues(new AudioValues().withPath(fakeBase + "/owned-audio.wav").withShowControls(true).withAutoPlay(false))));
      data.addBlock(new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.FLEX_ROW_WRAPPED)
         .withBlock(new InputFieldBlockData().withValues(new InputFieldValues()
            .withFieldMetaData(new QFieldMetaData("ownedMessage", QFieldType.STRING).withLabel("Owned message").withIsRequired(true)).withPlaceholder("Type an owned message")))
         .withBlock(new ButtonBlockData().withValues(new ButtonValues().withLabel("Submit owned").withActionCode("owned-submit")).withStyles(new ButtonStyles().withFormat("outlined"))));
      return (data);
   }
}
