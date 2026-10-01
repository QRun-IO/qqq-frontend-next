/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import java.sql.Connection;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import com.kingsrook.qqq.backend.core.actions.customizers.TableCustomizerInterface;
import com.kingsrook.qqq.backend.core.actions.customizers.TableCustomizers;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ParentWidgetRenderer;
import com.kingsrook.qqq.backend.core.context.QContext;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.actions.tables.QueryOrGetInputInterface;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.CompositeWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.ParentWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.QWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.RawHTML;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.bignumberblock.BigNumberBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.bignumberblock.BigNumberValues;
import com.kingsrook.qqq.backend.core.model.data.QRecord;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.ParentWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.WidgetDropdownData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.WidgetDropdownType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.AdornmentType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.FieldAdornment;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.help.HelpFormat;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpContent;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpRole;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValue;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSource;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSourceType;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** Widget chrome and dropdown extras (QRun-IO/qqq#728, WID-070 and WID-071):
 ** main and header icon tiles, per-breakpoint sizes, anchors, a parent label as
 ** the page title, slot help, the WIDGET field adornment in full chrome, and the
 ** Material dropdown options (searchable, width, start icon, clearable, previous
 ** and next, date picker, custom timeframe).
 *******************************************************************************/
final class WidgetChromeFixtures
{
   static final String CHROME_APP    = "widgetChromeExtras";
   static final String DROPDOWNS_APP = "widgetDropdownExtras";
   static final String HOST_TABLE    = "accChromeHost";

   private static final Map<String, AtomicInteger> RENDERS = new ConcurrentHashMap<>();



   /*******************************************************************************
    **
    *******************************************************************************/
   private WidgetChromeFixtures()
   {
   }



   /*******************************************************************************
    ** Add the widgets, their apps, the possible-value sources and the host table.
    *******************************************************************************/
   static void define(QInstance qInstance) throws QException
   {
      defineChrome(qInstance);
      defineDropdowns(qInstance);
      defineHost(qInstance);
      defineSetupHelp(qInstance);
   }



   /*******************************************************************************
    ** Create and seed the host table; reruns after every reset.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS acc_chrome_host");
         statement.execute("CREATE TABLE acc_chrome_host (id INTEGER PRIMARY KEY, name VARCHAR(100), summary VARCHAR(250))");
         statement.execute("INSERT INTO acc_chrome_host (id, name, summary) VALUES (1, 'Owned chrome host', NULL)");
      }
   }



   /*******************************************************************************
    ** The chrome dashboard: a parent whose label is the page title, icon tiles and
    ** per-breakpoint sizes, block slot help, and an anchor target below tall widgets.
    *******************************************************************************/
   private static void defineChrome(QInstance qInstance)
   {
      qInstance.addWidget(widget("accChromeTitleChild", WidgetType.HTML, "Owned Title Child").withGridColumns(12));
      ParentWidgetMetaData title = new ParentWidgetMetaData().withChildWidgetNameList(List.of("accChromeTitleChild"));
      title.withName("accChromeTitle").withType(WidgetType.PARENT_WIDGET.getType()).withIsCard(true).withGridColumns(12)
         .withShowReloadButton(true).withCodeReference(new QCodeReference(ChromeRenderer.class));
      qInstance.addWidget(title);

      qInstance.addWidget(widget("accChromeIcons", WidgetType.HTML, "Owned Icon Tiles").withGridColumns(12)
         .withIcon("local_shipping")
         .withIcon("topLeftInsideCard", new QIcon().withPath("/kr-icon.png").withColor("#0d47a1"))
         .withIcon("topRightInsideCard", new QIcon("inventory_2").withColor("#2e7d32"))
         .withDefaultValue("gridCols:sizeClass:md", 6)
         .withDefaultValue("gridCols:sizeClass:xl", 4));

      qInstance.addWidget(widget("accChromeHelp", WidgetType.COMPOSITE, "Owned Slot Help").withGridColumns(12)
         .withHelpContent("ownedHelpBlock,number", new QHelpContent("Owned <b>number</b> help").withFormat(HelpFormat.HTML))
         .withHelpContent("context", new QHelpContent("Owned context help")));

      List<String> widgets = new ArrayList<>(List.of("accChromeTitle", "accChromeIcons", "accChromeHelp"));
      for(String spacer : List.of("accChromeSpacerOne", "accChromeSpacerTwo"))
      {
         qInstance.addWidget(widget(spacer, WidgetType.HTML, "Owned Spacer").withGridColumns(12).withMinHeight("900px"));
         widgets.add(spacer);
      }
      qInstance.addWidget(widget("accChromeAnchor", WidgetType.HTML, "Owned Anchor Target").withGridColumns(12));
      widgets.add("accChromeAnchor");

      qInstance.addApp(new QAppMetaData().withName(CHROME_APP).withLabel("Widget Chrome Extras").withIcon(new QIcon("widgets")).withWidgets(widgets));
   }



   /*******************************************************************************
    ** The dropdown dashboard: every Material dropdown option on one widget.
    *******************************************************************************/
   private static void defineDropdowns(QInstance qInstance)
   {
      qInstance.addPossibleValueSource(enumSource("accColor", "Color", List.of(
         new QPossibleValue<>("red", "Red"), new QPossibleValue<>("orange", "Orange"), new QPossibleValue<>("yellow", "Yellow"),
         new QPossibleValue<>("green", "Green"), new QPossibleValue<>("blue", "Blue"), new QPossibleValue<>("violet", "Violet"))));
      qInstance.addPossibleValueSource(enumSource("accSize", "Size", List.of(
         new QPossibleValue<>("small", "Small"), new QPossibleValue<>("medium", "Medium"), new QPossibleValue<>("large", "Large"))));
      qInstance.addPossibleValueSource(enumSource("timeframe", "Timeframe", List.of(
         new QPossibleValue<>("today", "Today"), new QPossibleValue<>("week", "This Week"), new QPossibleValue<>("custom", "Custom"))));

      qInstance.addWidget(widget("accDropdownExtras", WidgetType.HTML, "Owned Dropdown Extras").withGridColumns(12).withStoreDropdownSelections(true)
         .withDropdown(new WidgetDropdownData().withPossibleValueSourceName("accColor").withLabel("Color").withWidth(300).withStartIconName("category").withAllowBackAndForth(true))
         .withDropdown(new WidgetDropdownData().withPossibleValueSourceName("accSize").withLabel("Size").withDisableClearable(true).withAllowBackAndForth(true).withBackAndForthInverted(true))
         .withDropdown(new WidgetDropdownData().withName("accDay").withLabel("Day").withType(WidgetDropdownType.DATE_PICKER).withAllowBackAndForth(true))
         .withDropdown(new WidgetDropdownData().withPossibleValueSourceName("timeframe").withLabel("Timeframe")));

      qInstance.addApp(new QAppMetaData().withName(DROPDOWNS_APP).withLabel("Widget Dropdown Extras").withIcon(new QIcon("tune"))
         .withWidgets(List.of("accDropdownExtras")));
   }



   /*******************************************************************************
    ** A table whose record view shows a WIDGET-adorned field (the value is the
    ** widget's data) in the full widget chrome.
    *******************************************************************************/
   private static void defineHost(QInstance qInstance)
   {
      qInstance.addWidget(widget("accChromeFieldWidget", WidgetType.HTML, "Owned Field Widget")
         .withTooltip("Owned field widget tip").withShowReloadButton(true).withShowExportButton(true)
         .withIcon("topRightInsideCard", new QIcon("star").withColor("#8f00d8"))
         .withHelpContent("label", new QHelpContent("Owned field widget help")));

      QTableMetaData host = new QTableMetaData().withName(HOST_TABLE).withLabel("Chrome Host").withPrimaryKeyField("id").withRecordLabelFormat("%s")
         .withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withMaxLength(100))
         .withField(new QFieldMetaData("summary", QFieldType.STRING).withIsEditable(false).withLabel("Summary")
            .withFieldAdornment(new FieldAdornment(AdornmentType.WIDGET).withValue(AdornmentType.WidgetValues.WIDGET_NAME, "accChromeFieldWidget")))
         .withCustomizer(TableCustomizers.POST_QUERY_RECORD, new QCodeReference(HostPostQuery.class))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name")))
         .withSection(new QFieldSection("fieldWidget", "Field Widget", new QIcon("widgets"), Tier.T2, List.of("summary")));
      host.setBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME);
      host.setBackendDetails(new RDBMSTableBackendDetails().withTableName("acc_chrome_host"));
      QInstanceEnricher.setInferredFieldBackendNames(host);
      qInstance.addTable(host);
   }



   /*******************************************************************************
    ** Help for the setup widgets' "sectionSubhead" slot (the saved report's filter
    ** and pivot widgets) and the cron widget's "top" slot.
    *******************************************************************************/
   private static void defineSetupHelp(QInstance qInstance)
   {
      QWidgetMetaData filters = (QWidgetMetaData) qInstance.getWidget("reportSetupWidget");
      filters.withHelpContent("sectionSubhead", new QHelpContent("Owned filters <b>subhead</b> help").withFormat(HelpFormat.HTML).withRole(QHelpRole.VIEW_SCREEN));
      QWidgetMetaData pivot = (QWidgetMetaData) qInstance.getWidget("pivotTableSetupWidget");
      pivot.withHelpContent("sectionSubhead", new QHelpContent("Owned pivot subhead help").withRole(QHelpRole.VIEW_SCREEN));
      QWidgetMetaData cron = (QWidgetMetaData) qInstance.getWidget("accHostCron");
      cron.withHelpContent("top", new QHelpContent("Owned schedule top help").withRole(QHelpRole.VIEW_SCREEN));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QPossibleValueSource enumSource(String name, String label, List<QPossibleValue<?>> values)
   {
      return (new QPossibleValueSource().withName(name).withLabel(label).withType(QPossibleValueSourceType.ENUM).withEnumValues(values));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QWidgetMetaData widget(String name, WidgetType type, String label)
   {
      return (new QWidgetMetaData().withName(name).withType(type.getType()).withLabel(label).withIsCard(true)
         .withCodeReference(new QCodeReference(ChromeRenderer.class)));
   }



   /*******************************************************************************
    ** Renders per session, so a test can tell its own first render from a reload.
    *******************************************************************************/
   private static int renders(String widgetName)
   {
      String session = QContext.getQSession() == null ? "none" : String.valueOf(QContext.getQSession().getUuid());
      return (RENDERS.computeIfAbsent(widgetName + "|" + session, n -> new AtomicInteger()).incrementAndGet());
   }



   /*******************************************************************************
    ** Supplies the WIDGET-adorned field's value (the widget's data).
    *******************************************************************************/
   public static class HostPostQuery implements TableCustomizerInterface
   {
      /***************************************************************************
       **
       ***************************************************************************/
      @Override
      public List<QRecord> postQuery(QueryOrGetInputInterface queryInput, List<QRecord> records) throws QException
      {
         for(QRecord record : records)
         {
            RawHTML value = new RawHTML("Owned Field Widget", "<p class=\"chrome-field-widget\">Field widget body for " + record.getValueString("name") + "</p>");
            value.setCsvData(new ArrayList<>(List.of(new ArrayList<>(List.of("Name", "Value")), new ArrayList<>(List.of(record.getValueString("name"), 1)))));
            record.setValue("summary", value);
         }
         return (records);
      }
   }



   /*******************************************************************************
    ** Owned display values for the chrome and dropdown widgets.
    *******************************************************************************/
   public static class ChromeRenderer extends AbstractWidgetRenderer
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input) throws QException
      {
         String              name   = input.getWidgetMetaData().getName();
         int                 count  = renders(name);
         Map<String, String> params = input.getQueryParams() == null ? Map.of() : input.getQueryParams();
         QWidgetData data = switch(name)
         {
            case "accChromeTitle" ->
            {
               ///////////////////////////////////////////////////////////////////////////
               // the label is the page title; a reload has no label (the page keeps it) //
               ///////////////////////////////////////////////////////////////////////////
               ParentWidgetData parent = (ParentWidgetData) new ParentWidgetRenderer().render(input).getWidgetData();
               parent.setIsLabelPageTitle(true);
               parent.setLabel(count == 1 ? "Owned Page Title" : null);
               yield (parent);
            }
            case "accChromeTitleChild" -> new RawHTML("Owned Title Child", "title child body");
            case "accChromeIcons" -> new RawHTML("Owned Icon Tiles", "icon tiles body");
            case "accChromeHelp" -> new CompositeWidgetData().withBlock(new BigNumberBlockData().withBlockId("ownedHelpBlock")
               .withValues(new BigNumberValues().withHeading("Owned heading").withNumber("42").withContext("owned context")));
            case "accChromeSpacerOne", "accChromeSpacerTwo" -> new RawHTML("Owned Spacer", "spacer body");
            case "accChromeAnchor" -> new RawHTML("Owned Anchor Target", "anchor target body");
            case "accDropdownExtras" ->
            {
               RawHTML html = new RawHTML("Owned Dropdown Extras", "color=" + params.getOrDefault("accColor", "") + "; size=" + params.getOrDefault("accSize", "")
                  + "; day=" + params.getOrDefault("accDay", "") + "; timeframe=" + params.getOrDefault("timeframe", "") + "; renders=" + count);
               setupDropdowns(input, (QWidgetMetaData) input.getWidgetMetaData(), html);
               yield (html);
            }
            case "accChromeFieldWidget" -> new RawHTML("Owned Field Widget", "<p class=\"chrome-field-widget\">Field widget reloaded for id=" + params.getOrDefault("id", "")
               + " table=" + params.getOrDefault("tableName", "") + "; renders=" + count + "</p>");
            default -> throw (new QException("Unexpected owned widget " + name));
         };
         return (new RenderWidgetOutput(data));
      }
   }
}
