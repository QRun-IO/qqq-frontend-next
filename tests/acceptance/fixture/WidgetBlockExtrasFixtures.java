/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */


import java.io.IOException;
import java.io.Serializable;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ChildRecordListRenderer;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QFilterOrderBy;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QueryJoin;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.CompositeWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.FieldValueListData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.QWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.StatisticsData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.StepperData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.USMapWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.button.ButtonValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.inputfield.InputFieldBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.inputfield.InputFieldValues;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextValues;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.AdornmentType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.CaseChangeBehavior;
import com.kingsrook.qqq.backend.core.model.metadata.fields.DisplayFormat;
import com.kingsrook.qqq.backend.core.model.metadata.fields.FieldAdornment;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinOn;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.QJoinMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSource;
import com.kingsrook.qqq.backend.core.model.metadata.tables.ExposedJoin;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;


/*******************************************************************************
 ** Widgets-area fixture additions for the Material parity of blocks, display
 ** widgets and custom components (QRun-IO/qqq#728, WID-072), called from
 ** WidgetsFixtures.define() and prime(). Synthetic, QRun-owned data only:
 ** - the widgetBlockExtras dashboard: a modal composite driven by button
 **   control codes, INPUT_FIELD blocks of every field type, statistics with a
 **   zero change and a pending count, a stepper with icon and color overrides,
 **   a field value list of typed values, a USA map of inland capitals and the
 **   Alaska and Hawaii insets, and a custom component that uses the qfmdBridge;
 ** - the widgetExtraRecords app: a host table whose record view lists typed
 **   child records with an exposed join table (childRecordList);
 ** - a loopback server for the custom component's bundle.
 *******************************************************************************/
final class WidgetBlockExtrasFixtures
{
   static final String APP         = "widgetBlockExtras";
   static final String RECORDS_APP = "widgetExtraRecords";
   static final String HOST_TABLE  = "accExtraHost";
   static final String CHILD_TABLE = "accExtraChild";
   static final String TAG_TABLE   = "accExtraTag";
   static final String HOST_JOIN   = "accExtraHostJoinChild";
   static final String TAG_JOIN    = "accExtraChildJoinTag";

   private static volatile HttpServer bundleServer;
   private static volatile String     bundleBase;



   /*******************************************************************************
    **
    *******************************************************************************/
   private WidgetBlockExtrasFixtures()
   {
   }



   /*******************************************************************************
    ** Add the dashboard, its widgets and the child-record tables.
    *******************************************************************************/
   static void define(QInstance qInstance) throws QException
   {
      startBundleServer();

      List<String> widgets = List.of(
         add(qInstance, widget("accModalComposite", WidgetType.COMPOSITE, "Owned Modal Composite").withGridColumns(6)),
         add(qInstance, widget("accStatisticsFlat", WidgetType.STATISTICS, "Owned Flat Statistics").withGridColumns(3)),
         add(qInstance, widget("accStatisticsPending", WidgetType.STATISTICS, "Owned Pending Statistics").withGridColumns(3)),
         add(qInstance, widget("accTypedInputs", WidgetType.COMPOSITE, "Owned Typed Inputs").withGridColumns(12)),
         add(qInstance, widget("accStepperOverrides", WidgetType.STEPPER, "Owned Stepper Overrides").withGridColumns(6)),
         add(qInstance, widget("accFieldValuesTyped", WidgetType.FIELD_VALUE_LIST, "Owned Typed Values").withGridColumns(6)),
         add(qInstance, widget("accUsaMapStates", WidgetType.USA_MAP, "Owned State Map").withGridColumns(8)),
         add(qInstance, widget("accBridgeComponent", WidgetType.CUSTOM_COMPONENT, "Owned Bridge Component").withGridColumns(12)
            .withDefaultValue("componentName", "OwnedBridgeComponent").withDefaultValue("componentSourceUrl", bundleBase + "/owned-bridge.js")));
      qInstance.addApp(new QAppMetaData().withName(APP).withLabel("Widget Block Extras").withIcon(new QIcon("extension")).withWidgets(widgets));

      defineChildRecords(qInstance);
   }



   /*******************************************************************************
    ** Standalone input editors, independently of the unrelated extras dashboards.
    *******************************************************************************/
   static void defineInputEditors(QInstance qInstance)
   {
      String inputWidget = add(qInstance, widget("accTypedInputs", WidgetType.COMPOSITE, "Owned Typed Inputs").withGridColumns(12));
      qInstance.addApp(new QAppMetaData().withName("widgetInputEditors").withLabel("Widget Input Editors")
         .withIcon(new QIcon("edit")).withWidgets(List.of(inputWidget)));
   }



   /*******************************************************************************
    ** Host, child and tag tables; the child list widget on the host record view.
    *******************************************************************************/
   private static void defineChildRecords(QInstance qInstance)
   {
      QTableMetaData tag = rdbms(new QTableMetaData().withName(TAG_TABLE).withLabel("Extra Tag").withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("label")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("code", QFieldType.STRING).withLabel("Code"))
         .withField(new QFieldMetaData("label", QFieldType.STRING).withLabel("Label"))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "code", "label"))));
      qInstance.addTable(tag);
      qInstance.addPossibleValueSource(QPossibleValueSource.newForTable(TAG_TABLE));

      QTableMetaData host = rdbms(new QTableMetaData().withName(HOST_TABLE).withLabel("Extra Host").withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name")))
         .withSection(new QFieldSection().withName("extraChildren").withLabel("Owned Extra Children").withTier(Tier.T2).withWidgetName("accExtraChildren")));
      qInstance.addTable(host);
      qInstance.addPossibleValueSource(QPossibleValueSource.newForTable(HOST_TABLE));

      QTableMetaData child = rdbms(new QTableMetaData().withName(CHILD_TABLE).withLabel("Extra Child").withPrimaryKeyField("id")
         .withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("hostId", QFieldType.INTEGER).withLabel("Host").withPossibleValueSourceName(HOST_TABLE))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withLabel("Name"))
         .withField(new QFieldMetaData("dueDate", QFieldType.DATE).withLabel("Due Date"))
         .withField(new QFieldMetaData("isActive", QFieldType.BOOLEAN).withLabel("Active"))
         .withField(new QFieldMetaData("tagId", QFieldType.INTEGER).withLabel("Tag").withPossibleValueSourceName(TAG_TABLE))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "hostId", "name", "dueDate", "isActive", "tagId")))
         .withExposedJoin(new ExposedJoin().withLabel("Owned Tag").withJoinTable(TAG_TABLE).withJoinPath(List.of(TAG_JOIN))));
      qInstance.addTable(child);

      QJoinMetaData hostJoin = new QJoinMetaData().withName(HOST_JOIN).withLeftTable(HOST_TABLE).withRightTable(CHILD_TABLE)
         .withType(JoinType.ONE_TO_MANY).withJoinOn(new JoinOn("id", "hostId"));
      qInstance.addJoin(hostJoin);
      qInstance.addJoin(new QJoinMetaData().withName(TAG_JOIN).withLeftTable(CHILD_TABLE).withRightTable(TAG_TABLE)
         .withType(JoinType.MANY_TO_ONE).withJoinOn(new JoinOn("tagId", "id")));

      //////////////////////////////////////////////////////////////////////////
      // keep the join field so the frontend hides the parent's key itself    //
      // (as Material does for the new-child defaults), yet exports it        //
      //////////////////////////////////////////////////////////////////////////
      QWidgetMetaData children = ChildRecordListRenderer.widgetMetaDataBuilder(hostJoin).withName("accExtraChildren").withLabel("Owned Extra Children")
         .withMaxRows(2).withCanAddChildRecord(true).withKeepJoinField(true).withOrderBys(List.of(new QFilterOrderBy("id")))
         .withQueryJoins(List.of(new QueryJoin(TAG_TABLE).withSelect(true).withType(QueryJoin.Type.LEFT)))
         .getWidgetMetaData();
      children.withShowExportButton(true);
      qInstance.addWidget(children);

      qInstance.addApp(new QAppMetaData().withName(RECORDS_APP).withLabel("Widget Extra Records").withIcon(new QIcon("table_view"))
         .withChild(host).withChild(child).withChild(tag));
   }



   /*******************************************************************************
    ** Create and seed the child-record tables (idempotent).
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS acc_extra_child");
         statement.execute("DROP TABLE IF EXISTS acc_extra_tag");
         statement.execute("DROP TABLE IF EXISTS acc_extra_host");
         statement.execute("CREATE TABLE acc_extra_host (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))");
         statement.execute("CREATE TABLE acc_extra_tag (id INTEGER AUTO_INCREMENT PRIMARY KEY, code VARCHAR(20), label VARCHAR(100))");
         statement.execute("CREATE TABLE acc_extra_child (id INTEGER AUTO_INCREMENT PRIMARY KEY, host_id INTEGER, name VARCHAR(100), due_date DATE, "
            + "is_active BOOLEAN, tag_id INTEGER)");
         statement.execute("INSERT INTO acc_extra_host (id, name) VALUES (1, 'Owned extra host'), (2, 'Owned other host')");
         statement.execute("INSERT INTO acc_extra_tag (id, code, label) VALUES (5, 'OWN-5', 'Owned tag five'), (6, 'OWN-6', 'Owned tag six')");
         statement.execute("INSERT INTO acc_extra_child (id, host_id, name, due_date, is_active, tag_id) VALUES "
            + "(1, 1, 'Owned extra alpha', DATE '2026-03-04', TRUE, 5), "
            + "(2, 1, 'Owned \"quoted\" beta', DATE '2026-04-05', FALSE, NULL), "
            + "(3, 1, 'Owned extra gamma', DATE '2026-05-06', TRUE, 6), "
            + "(4, 2, 'Owned other child', DATE '2026-06-07', TRUE, 5)");
         statement.execute("ALTER TABLE acc_extra_host ALTER COLUMN id RESTART WITH 100");
         statement.execute("ALTER TABLE acc_extra_tag ALTER COLUMN id RESTART WITH 100");
         statement.execute("ALTER TABLE acc_extra_child ALTER COLUMN id RESTART WITH 100");
      }
   }



   /*******************************************************************************
    ** A widget rendered by {@link ExtrasRenderer}.
    *******************************************************************************/
   private static QWidgetMetaData widget(String name, WidgetType type, String label)
   {
      return (new QWidgetMetaData().withName(name).withType(type.getType()).withLabel(label).withIsCard(true)
         .withCodeReference(new QCodeReference(ExtrasRenderer.class)));
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
   private static QTableMetaData rdbms(QTableMetaData table)
   {
      table.setBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME);
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
      QInstanceEnricher.setInferredFieldBackendNames(table);
      return (table);
   }



   /*******************************************************************************
    ** Serves the custom component bundle. It is built on window.React (hooks
    ** only work with the dashboard's own React) and renders the bridge's alert,
    ** buttons, form, modal, widget and icon, and values from the live qContext.
    *******************************************************************************/
   private static synchronized void startBundleServer() throws QException
   {
      if(bundleServer != null)
      {
         return;
      }
      try
      {
         HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
         server.createContext("/", exchange ->
         {
            exchange.getRequestBody().readAllBytes();
            if(exchange.getRequestURI().getPath().equals("/owned-bridge.js"))
            {
               respond(exchange, 200, "application/javascript", BUNDLE.getBytes(StandardCharsets.UTF_8));
            }
            else
            {
               respond(exchange, 404, "text/plain", "not found".getBytes(StandardCharsets.UTF_8));
            }
         });
         server.start();
         bundleServer = server;
         bundleBase = "http://127.0.0.1:" + server.getAddress().getPort();
         Runtime.getRuntime().addShutdownHook(new Thread(() -> server.stop(0)));
      }
      catch(IOException e)
      {
         throw (new QException("Could not start the owned bundle server", e));
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



   /////////////////////////////////////////////////////////////////////////////
   // the owned bridge component, in plain ES5 as a Material-era bundle would //
   /////////////////////////////////////////////////////////////////////////////
   private static final String BUNDLE = String.join("\n",
      "window.OwnedBridgeComponent = { OwnedBridgeComponent: function (args) {",
      "  var R = window.React, b = args.qfmdBridge, q = args.qContext || {}, p = args.props;",
      "  var clicks = R.useState(0), typed = R.useState('Initial owned'), submitted = R.useState(''), modal = R.useState(false), closed = R.useState('');",
      "  var e = R.createElement;",
      "  return e('div', { 'data-owned-bridge': 'root' },",
      "    b.makeAlert('Owned bridge alert for ' + p.widgetMetaData.label + '\\nOwned second line', 'success'),",
      "    e('p', { 'data-owned': 'accent' }, 'Accent: ' + q.accentColor),",
      "    e('p', { 'data-owned': 'app' }, 'App: ' + (q.branding ? q.branding.appName : '')),",
      "    e('p', { 'data-owned': 'react' }, 'Globals: ' + (typeof window.ReactDOM.createRoot) + ' ' + (typeof window.ReactDOM.createPortal)),",
      "    b.makeButton('Owned clicks ' + clicks[0], function () { clicks[1](clicks[0] + 1); }),",
      "    b.makeButton('Open owned bridge modal', function () { modal[1](true); }, { variant: 'outlined' }),",
      "    b.makeForm([{ name: 'ownedName', label: 'Owned Name', type: 'STRING' }], { values: { ownedName: 'Initial owned' } },",
      "      function (name, value) { typed[1](value); }, function (values) { submitted[1](values.ownedName); }),",
      "    e('p', { 'data-owned': 'typed' }, 'Typed: ' + typed[0]),",
      "    e('p', { 'data-owned': 'submitted' }, 'Submitted: ' + submitted[0]),",
      "    e('p', { 'data-owned': 'closed' }, 'Closed: ' + closed[0]),",
      "    modal[0] ? b.makeModal(e('p', null, 'Owned bridge modal content'), function (setIsOpen, event, reason) { setIsOpen(false); modal[1](false); closed[1](reason); }) : null,",
      "    e('span', { 'data-owned': 'icon' }, b.makeIcon('star')),",
      "    b.makeWidget('accHealthy'));",
      "} };");



   /*******************************************************************************
    ** INPUT_FIELD values with a seeded value (as a process step seeds them).
    *******************************************************************************/
   public static class SeededInputValues extends InputFieldValues
   {
      private final Serializable value;



      /*******************************************************************************
       **
       *******************************************************************************/
      public SeededInputValues(QFieldMetaData fieldMetaData, Serializable value)
      {
         super(fieldMetaData);
         this.value = value;
      }



      /*******************************************************************************
       **
       *******************************************************************************/
      public Serializable getValue()
      {
         return (value);
      }
   }



   /*******************************************************************************
    ** Fixed, owned payloads for the extras dashboard.
    *******************************************************************************/
   public static class ExtrasRenderer extends AbstractWidgetRenderer
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input) throws QException
      {
         String name = input.getWidgetMetaData().getName();
         QWidgetData data = switch(name)
         {
            case "accModalComposite" -> modalComposite();
            case "accStatisticsFlat" -> new StatisticsData(42, 0, "vs owned flat period").withCountContext("owned flat units");
            case "accStatisticsPending" -> new StatisticsData().withCountContext("owned pending units").withPercentageAmount(7).withPercentageLabel("vs owned pending");
            case "accTypedInputs" -> typedInputs();
            case "accStepperOverrides" -> new StepperData("Owned override steps", 1, List.of(
               new StepperData.Step().withLabel("Owned received").withIconOverride("inventory").withColorOverride("#8F00D8"),
               new StepperData.Step().withLabel("Owned packing").withColorOverride("#0062FF").withLinkText("Owned pack link").withLinkURL("/app/person"),
               new StepperData.Step().withLabel("Owned shipping").withIconOverride("local_shipping")));
            case "accFieldValuesTyped" -> typedValues();
            case "accUsaMapStates" -> new USMapWidgetData().withHeight("320px").withMapMarkerList(List.of(
               new USMapWidgetData.MapMarker("Owned Springfield", new BigDecimal("39.7817"), new BigDecimal("-89.6501")),
               new USMapWidgetData.MapMarker("Owned Denver", new BigDecimal("39.7392"), new BigDecimal("-104.9903")),
               new USMapWidgetData.MapMarker("Owned Austin", new BigDecimal("30.2672"), new BigDecimal("-97.7431")),
               new USMapWidgetData.MapMarker("Owned Fairbanks", new BigDecimal("64.8378"), new BigDecimal("-147.7164")),
               new USMapWidgetData.MapMarker("Owned Honolulu", new BigDecimal("21.3069"), new BigDecimal("-157.8583"))));
            case "accBridgeComponent" -> new WidgetsFixtures.OwnedData("customComponent").withFooterHTML("Owned bridge value");
            default -> throw (new QException("Unexpected owned extras widget " + name));
         };
         return (new RenderWidgetOutput(data));
      }



      /*******************************************************************************
       ** Buttons whose control codes open, toggle and close a modal composite.
       *******************************************************************************/
      private static CompositeWidgetData modalComposite()
      {
         CompositeWidgetData data = new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.FLEX_ROW_WRAPPED);
         data.addBlock(new ButtonBlockData().withValues(new ButtonValues().withLabel("Open owned details").withControlCode("showModal:ownedDetails")));
         data.addBlock(new ButtonBlockData().withValues(new ButtonValues().withLabel("Toggle owned details").withControlCode("toggleModal:ownedDetails")));
         data.addBlock(new CompositeWidgetData().withBlockId("ownedDetails").withModalMode(CompositeWidgetData.ModalMode.MODAL)
            .withLayout(CompositeWidgetData.Layout.FLEX_COLUMN)
            .withBlock(new TextBlockData().withValues(new TextValues().withText("Owned modal content")))
            .withBlock(new ButtonBlockData().withValues(new ButtonValues().withLabel("Close owned details").withControlCode("hideModal:ownedDetails"))));
         return (data);
      }



      /*******************************************************************************
       ** One INPUT_FIELD block per field type, some seeded.
       *******************************************************************************/
      private static CompositeWidgetData typedInputs()
      {
         CompositeWidgetData data = new CompositeWidgetData().withLayout(CompositeWidgetData.Layout.FLEX_ROW_WRAPPED);
         List<InputFieldValues> inputs = List.of(
            new SeededInputValues(new QFieldMetaData("ownedText", QFieldType.STRING).withLabel("Owned Text"), "Owned seeded text"),
            new SeededInputValues(new QFieldMetaData("ownedUpper", QFieldType.STRING).withLabel("Owned Upper").withBehavior(CaseChangeBehavior.TO_UPPER_CASE), "abCd"),
            new SeededInputValues(new QFieldMetaData("ownedLower", QFieldType.STRING).withLabel("Owned Lower").withBehavior(CaseChangeBehavior.TO_LOWER_CASE), "abCd"),
            new SeededInputValues(new QFieldMetaData("ownedCount", QFieldType.INTEGER).withLabel("Owned Count"), 7),
            new InputFieldValues(new QFieldMetaData("ownedAmount", QFieldType.DECIMAL).withLabel("Owned Amount").withDisplayFormat(DisplayFormat.CURRENCY)),
            new SeededInputValues(new QFieldMetaData("ownedChoice", QFieldType.STRING).withLabel("Owned Choice").withPossibleValueSourceName(WidgetsFixtures.CHOICE_PVS), "alpha"),
            new SeededInputValues(new QFieldMetaData("ownedDay", QFieldType.DATE).withLabel("Owned Day"), "2026-03-04"),
            new SeededInputValues(new QFieldMetaData("ownedStamp", QFieldType.DATE_TIME).withLabel("Owned Stamp"), "2024-03-10T06:30:07Z"),
            new InputFieldValues(new QFieldMetaData("ownedClock", QFieldType.TIME).withLabel("Owned Clock")),
            new InputFieldValues(new QFieldMetaData("ownedSecret", QFieldType.PASSWORD).withLabel("Owned Secret")),
            new SeededInputValues(new QFieldMetaData("ownedFlag", QFieldType.BOOLEAN).withLabel("Owned Flag"), true),
            new InputFieldValues(new QFieldMetaData("ownedFile", QFieldType.BLOB).withLabel("Owned File")),
            new InputFieldValues(new QFieldMetaData("ownedNotes", QFieldType.TEXT).withLabel("Owned Notes")),
            new InputFieldValues(new QFieldMetaData("ownedScript", QFieldType.STRING).withLabel("Owned Script")
               .withFieldAdornment(new FieldAdornment(AdornmentType.CODE_EDITOR).withValue("languageMode", "javascript"))));
         for(InputFieldValues values : inputs)
         {
            data.addBlock(new InputFieldBlockData().withValues(values));
         }
         return (data);
      }



      /*******************************************************************************
       ** Values of several types, a display format and adornments.
       *******************************************************************************/
      private static FieldValueListData typedValues()
      {
         FieldValueListData fields = new FieldValueListData();
         fields.addFieldWithValue("ownedActive", QFieldType.BOOLEAN, true).withLabel("Owned Active");
         fields.addFieldWithValue("ownedAmount", QFieldType.DECIMAL, new BigDecimal("1234.5")).withLabel("Owned Amount").withDisplayFormat(DisplayFormat.CURRENCY);
         fields.addFieldWithValue("ownedStamp", QFieldType.DATE_TIME, Instant.parse("2026-03-04T05:06:07Z")).withLabel("Owned Stamp");
         fields.addFieldWithValue("ownedNotes", QFieldType.TEXT, "Owned line one\nOwned line two").withLabel("Owned Notes");
         fields.addFieldWithValue("ownedPerson", QFieldType.INTEGER, 1, "Owned linked person").withLabel("Owned Person")
            .withFieldAdornment(new FieldAdornment(AdornmentType.LINK).withValue(AdornmentType.LinkValues.TO_RECORD_FROM_TABLE, SampleMetaDataProvider.TABLE_NAME_PERSON));
         fields.addFieldWithValue("ownedStatus", QFieldType.STRING, "done", "Done").withLabel("Owned Status")
            .withFieldAdornment(new FieldAdornment(AdornmentType.CHIP).withValue("color.done", "success"));
         fields.addFieldWithValue("ownedContact", QFieldType.STRING, "owned@example.com").withLabel("Owned Contact");
         return (fields);
      }
   }
}
