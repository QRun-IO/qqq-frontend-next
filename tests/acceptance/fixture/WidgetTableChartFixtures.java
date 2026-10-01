/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.ChartData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.CompositeWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.MultiTableData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.QWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.TableData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextBlockData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.blocks.text.TextValues;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.help.HelpFormat;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpContent;
import com.kingsrook.qqq.backend.core.model.metadata.help.QHelpRole;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;


/*******************************************************************************
 ** Table and chart widgets for the Material table and chart extras (QRun-IO/qqq#728,
 ** WID-068 and WID-069): typed cells, sub-rows, widths, paging, column-header help,
 ** per-table export and footer in a multi-table widget; theme color names, legend
 ** toggles, pie percent tooltips, stacked axis and tooltip, line badges, small line
 ** ticks and the bar chart "As of" line.
 *******************************************************************************/
final class WidgetTableChartFixtures
{
   static final String APP = "widgetTableCharts";



   /*******************************************************************************
    **
    *******************************************************************************/
   private WidgetTableChartFixtures()
   {
   }



   /*******************************************************************************
    ** Add the widgets and their app.
    *******************************************************************************/
   static void define(QInstance qInstance)
   {
      List<String> widgets = new ArrayList<>();
      widgets.add(add(qInstance, widget("accTableCells", WidgetType.TABLE, "Owned Typed Cells").withGridColumns(12).withShowExportButton(true)
         .withHelpContent("columnHeader=name", new QHelpContent("Owned <b>name</b> column help").withFormat(HelpFormat.HTML).withRoles(QHelpRole.ALL_SCREENS))));
      widgets.add(add(qInstance, widget("accTablePaging", WidgetType.TABLE, "Owned Paging").withGridColumns(12)));
      widgets.add(add(qInstance, widget("accMultiTableExtras", WidgetType.MULTI_TABLE, "Owned Multi Tables").withGridColumns(12).withShowExportButton(true)));
      widgets.add(add(qInstance, widget("accPieNamed", WidgetType.PIE_CHART, "Owned Pie").withGridColumns(6)));
      widgets.add(add(qInstance, widget("accStackedExtras", WidgetType.STACKED_BAR_CHART, "Owned Stacked Extras").withGridColumns(12)));
      widgets.add(add(qInstance, widget("accLineBadges", WidgetType.LINE_CHART, "Owned Line Badges").withGridColumns(6)));
      widgets.add(add(qInstance, widget("accHorizontalLegend", WidgetType.HORIZONTAL_BAR_CHART, "Owned Horizontal Legend").withGridColumns(6)));
      widgets.add(add(qInstance, widget("accSmallLineTicks", WidgetType.SMALL_LINE_CHART, "Owned Small Line").withGridColumns(6)));
      widgets.add(add(qInstance, widget("accBarAsOf", WidgetType.BAR_CHART, "Owned Bar As Of").withGridColumns(6)));
      qInstance.addApp(new QAppMetaData().withName(APP).withLabel("Widget Tables And Charts").withIcon(new QIcon("table_chart")).withWidgets(widgets));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QWidgetMetaData widget(String name, WidgetType type, String label)
   {
      return (new QWidgetMetaData().withName(name).withType(type.getType()).withLabel(label).withIsCard(true)
         .withCodeReference(new QCodeReference(Renderer.class)));
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
    ** Every Material cell type, hidden helper columns, fr and fixed widths, and a
    ** row with sub-rows (one of which has its own sub-row).
    *******************************************************************************/
   static TableData typedCells()
   {
      List<TableData.Column> columns = List.of(
         new TableData.Column("html", "Name", "name", "2fr", null),
         new TableData.Column("default", "Count", "count", "1fr", "right"),
         new TableData.Column("htmlAndTooltip", "Status", "status", "1fr", null),
         new TableData.Column("image", "Product", "product", "180px", null),
         new TableData.Column("composite", "Detail", "detail", "1fr", null),
         new TableData.Column("hidden", "Tooltip", "tooltip", null, null),
         new TableData.Column("hidden", "Image URL", "imageUrl", null, null),
         new TableData.Column("hidden", "Image Label", "imageLabel", null, null),
         new TableData.Column("hidden", "Image Total", "imageTotal", null, null),
         new TableData.Column("hidden", "Image Total Type", "imageTotalType", null, null));

      List<Map<String, Object>> rows = new ArrayList<>();
      Map<String, Object> first = row("<a href=\"/app/person/1\">Owned parent<span class=\"material-icons-round notranslate MuiIcon-root MuiIcon-fontSizeInherit\">open_in_new</span></a>",
         1234567, "<b>Shipped</b>", "<i>Left the owned dock</i>", 2500, "sold");
      first.put("detail", new CompositeWidgetData().withBlock(new TextBlockData().withValues(new TextValues().withText("Owned composite cell"))));
      Map<String, Object> child = row("Owned child one", 7, "<b>Packed</b>", "<i>Owned child tip</i>", null, null);
      Map<String, Object> nested = row("Owned child two", 8, "<b>Waiting</b>", "<i>Owned nested tip</i>", null, null);
      nested.put("subRows", new ArrayList<>(List.of(row("Owned grandchild", 9, "<b>Queued</b>", "<i>Owned grandchild tip</i>", null, null))));
      first.put("subRows", new ArrayList<>(List.of(child, nested)));
      rows.add(first);
      rows.add(row("Owned second", 42, "<b>Open</b>", "<i>Owned second tip</i>", 0, null));
      return (new TableData(null, columns, rows));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static Map<String, Object> row(String name, Integer count, String status, String tooltip, Integer imageTotal, String imageTotalType)
   {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("name", name);
      row.put("count", count);
      row.put("status", status);
      row.put("tooltip", tooltip);
      if(imageTotal != null)
      {
         row.put("imageUrl", WidgetsFixtures.fakeServiceBase() + "/owned-image.png");
         row.put("imageLabel", "Owned product");
         row.put("imageTotal", imageTotal);
         row.put("imageTotalType", imageTotalType);
      }
      return (row);
   }



   /*******************************************************************************
    ** 40 rows, no rowsPerPage (Material shows 10), the entries-per-page select on,
    ** and a fixed height that scrolls under a sticky header.
    *******************************************************************************/
   static TableData paging()
   {
      List<Map<String, Object>> rows = new ArrayList<>();
      for(int i = 1; i <= 40; i++)
      {
         Map<String, Object> row = new LinkedHashMap<>();
         row.put("name", "Owned row " + i);
         row.put("amount", i * 1000);
         rows.add(row);
      }
      return (new TableData(null, List.of(new TableData.Column("default", "Row", "name", null, null), new TableData.Column("default", "Amount", "amount", null, "right")), rows)
         .withHidePaginationDropdown(false).withFixedHeight(200));
   }



   /*******************************************************************************
    ** Two tables, each with its own label and footer; the first exports from its
    ** columns and rows, the second from its csvData.
    *******************************************************************************/
   static MultiTableData multiTables()
   {
      TableData first = new TableData("Owned first table", List.of(new TableData.Column("html", "Name", "name", null, null), new TableData.Column("default", "Qty", "qty", null, "right")),
         List.of(Map.of("name", "<a href=\"/app/person/2\">Owned alpha<span class=\"material-icons-round MuiIcon-root\">open_in_new</span></a>", "qty", 1500)));
      first.setFooterHTML("<i>Owned first footer</i>");
      TableData second = new TableData("Owned second table", List.of(new TableData.Column("default", "Name", "name", null, null)), List.of(Map.of("name", "Owned beta")));
      second.setFooterHTML("<b>Owned second footer</b>");
      second.setCsvData(List.of(List.<Serializable>of("Owned CSV header"), List.<Serializable>of("Owned CSV value")));
      return (new MultiTableData(List.of(first, second)));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static ChartData chart(String title, List<String> labels, List<ChartData.Data.Dataset> datasets)
   {
      ChartData chart = new ChartData();
      chart.setTitle(title);
      chart.setChartData(new ChartData.Data().withLabels(labels).withDatasets(datasets));
      return (chart);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static ChartData.Data.Dataset dataset(String label, List<Number> data)
   {
      return (new ChartData.Data.Dataset().withLabel(label).withData(data));
   }



   /*******************************************************************************
    ** Fixed, owned display values for each widget.
    *******************************************************************************/
   public static class Renderer extends AbstractWidgetRenderer
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input) throws QException
      {
         String name = input.getWidgetMetaData().getName();
         List<String> longLabels = new ArrayList<>();
         for(int i = 1; i <= 10; i++)
         {
            longLabels.add("Owned long category " + i);
         }
         QWidgetData data = switch(name)
         {
            case "accTableCells" -> typedCells();
            case "accTablePaging" -> paging();
            case "accMultiTableExtras" -> multiTables();
            case "accPieNamed" -> chart("Owned pie", List.of("Alpha", "Beta", "Gamma"),
               List.of(dataset("Owned slices", List.of(1, 2, 3)).withBackgroundColors(List.of("info", "success", "#8E24AA"))));
            case "accStackedExtras" -> chart("Owned stacked", longLabels,
               List.of(dataset("North", List.of(1, 2, 3, 1, 2, 3, 1, 2, 3, 1)).withBackgroundColor("success"),
                  dataset("South", List.of(2, 1, 0, 2, 1, 0, 2, 1, 0, 2)).withBackgroundColor("#8E24AA")));
            case "accLineBadges" -> chart("Owned line", List.of("Jan", "Feb", "Mar"), List.of(dataset("Owned units", List.of(3, 5, 4)).withColor("info")));
            case "accHorizontalLegend" -> chart("Owned horizontal", List.of("First", "Second"), List.of(dataset("Owned only series", List.of(4, 6))));
            case "accSmallLineTicks" -> chart("Owned small line", List.of("Jan", "Feb", "Mar", "Apr"), List.of(dataset("Owned small series", List.of(10, 40, 20, 30))));
            case "accBarAsOf" -> chart("Owned bar", List.of("One", "Two"), List.of(dataset("Owned bar series", List.of(5, 7))));
            default -> throw (new QException("Unknown owned table/chart widget " + name));
         };
         return (new RenderWidgetOutput(data));
      }
   }
}
