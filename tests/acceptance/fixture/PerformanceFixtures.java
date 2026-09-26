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

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.AbstractWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.processes.BackendStep;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.model.actions.processes.RunBackendStepInput;
import com.kingsrook.qqq.backend.core.model.actions.processes.RunBackendStepOutput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetInput;
import com.kingsrook.qqq.backend.core.model.actions.widgets.RenderWidgetOutput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.ChartData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.QWidgetData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.StatisticsData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.TableData;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.QWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppSection;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QBackendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QComponentType;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendComponentMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QProcessMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Capability;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.module.rdbms.jdbc.ConnectionManager;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Performance matrix area
 ** (QRun-IO/qqq#710). Synthetic, QRun-owned data only.
 **
 ** - prfWide: a read-only table of 10,000 rows and 40 columns of mixed types.
 **   Every value is a function of the row id and column number (see value()),
 **   so specs can compute any cell without reading the database.
 ** - prfDashboard: an app home with 24 widgets (statistics, bar, line and pie
 **   charts, and 100-row tables).
 ** - prfLongRun: an asynchronous process that walks all 10,000 prfWide rows,
 **   reporting progress, and logs its total to prf_run_log.
 *******************************************************************************/
final class PerformanceFixtures
{
   static final String TABLE         = "prfWide";
   static final String LAB_APP       = "prfLab";
   static final String DASHBOARD_APP = "prfDashboard";
   static final String PROCESS       = "prfLongRun";
   static final int    ROWS          = 10_000;
   static final int    COLUMNS       = 40;

   /////////////////////////////////////////////////////////////////////////
   // column n (3..40) cycles through these types; 1 is id and 2 is name //
   /////////////////////////////////////////////////////////////////////////
   private static final String[] KINDS = { "text", "count", "amount", "day", "moment", "flag" };



   private PerformanceFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (table, widgets, process, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance qInstance) throws QException
   {
      QTableMetaData table = new QTableMetaData().withName(TABLE).withLabel("Performance Wide")
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withIcon(new QIcon("speed"))
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING))
         .withoutCapabilities(Capability.TABLE_INSERT, Capability.TABLE_UPDATE, Capability.TABLE_DELETE);
      List<String> details = new ArrayList<>();
      for(int column = 3; column <= COLUMNS; column++)
      {
         table.withField(new QFieldMetaData(fieldName(column), fieldType(column)).withLabel(fieldLabel(column)).withBackendName(fieldName(column)));
         details.add(fieldName(column));
      }
      ////////////////////////////////////////////////////////////////
      // sections fix the column order (the field map is unordered) //
      ////////////////////////////////////////////////////////////////
      table.withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name")));
      table.withSection(new QFieldSection("columns", "Columns", new QIcon("view_column"), Tier.T2, details));
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName("prf_wide"));
      qInstance.addTable(table);

      List<String> widgets = new ArrayList<>();
      for(int i = 1; i <= 6; i++)
      {
         widgets.add(widget(qInstance, "prfStatistics" + i, WidgetType.STATISTICS, "Statistic " + i, 2));
      }
      for(int i = 1; i <= 6; i++)
      {
         widgets.add(widget(qInstance, "prfBar" + i, WidgetType.BAR_CHART, "Bar Chart " + i, 4));
      }
      for(int i = 1; i <= 4; i++)
      {
         widgets.add(widget(qInstance, "prfLine" + i, WidgetType.LINE_CHART, "Line Chart " + i, 6));
      }
      for(int i = 1; i <= 4; i++)
      {
         widgets.add(widget(qInstance, "prfPie" + i, WidgetType.PIE_CHART, "Pie Chart " + i, 3));
      }
      for(int i = 1; i <= 4; i++)
      {
         widgets.add(widget(qInstance, "prfTable" + i, WidgetType.TABLE, "Table " + i, 6));
      }
      qInstance.addApp(new QAppMetaData().withName(DASHBOARD_APP).withLabel("Performance Dashboard").withIcon(new QIcon("dashboard")).withWidgets(widgets));

      qInstance.addProcess(new QProcessMetaData()
         .withName(PROCESS)
         .withLabel("Long Process")
         .withIcon(new QIcon("hourglass_bottom"))
         .withStep(new QFrontendStepMetaData()
            .withName("configure")
            .withLabel("Configure")
            .withComponent(new QFrontendComponentMetaData().withType(QComponentType.EDIT_FORM))
            .withFormField(new QFieldMetaData("pauseMillis", QFieldType.INTEGER).withLabel("Pause Millis").withDefaultValue(250)))
         .withStep(new QBackendStepMetaData().withName("walk").withCode(new QCodeReference(WalkRowsStep.class)))
         .withStep(new QFrontendStepMetaData()
            .withName("finished")
            .withLabel("Finished")
            .withComponent(new QFrontendComponentMetaData().withType(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("rowCount", QFieldType.INTEGER).withLabel("Row Count"))
            .withViewField(new QFieldMetaData("countTotal", QFieldType.INTEGER).withLabel("Count Total"))));

      qInstance.addApp(new QAppMetaData().withName(LAB_APP).withLabel("Performance Lab").withIcon(new QIcon("speed"))
         .withSectionOfChildren(new QAppSection().withName("performance").withLabel("Performance").withIcon(new QIcon("speed")),
            qInstance.getTable(TABLE), qInstance.getProcess(PROCESS)));
   }



   /*******************************************************************************
    ** Create and seed the fixture tables; runs at startup and on every
    ** /acceptance/reset. The wide table is read-only (no insert, update or delete
    ** capability, and no spec writes it), so an intact copy is kept rather than
    ** re-inserting 400,000 values before every test; anything else is rebuilt.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS prf_run_log");
         statement.execute("CREATE TABLE prf_run_log (id INT AUTO_INCREMENT PRIMARY KEY, row_count INT, count_total BIGINT, started_millis BIGINT, finished_millis BIGINT)");
         if(isWideTableIntact(connection))
         {
            return;
         }
         statement.execute("DROP TABLE IF EXISTS prf_wide");
         StringBuilder ddl    = new StringBuilder("CREATE TABLE prf_wide (id INT PRIMARY KEY, name VARCHAR(40)");
         StringBuilder select = new StringBuilder("INSERT INTO prf_wide SELECT X, 'Row ' || LPAD(X, 5, '0')");
         for(int column = 3; column <= COLUMNS; column++)
         {
            ddl.append(", ").append(fieldName(column)).append(' ').append(sqlType(column));
            select.append(", ").append(sqlValue(column));
         }
         statement.execute(ddl.append(')').toString());
         statement.execute(select.append(" FROM SYSTEM_RANGE(1, ").append(ROWS).append(')').toString());
      }
   }



   /*******************************************************************************
    ** Whether prf_wide exists with every row and the expected checksum.
    *******************************************************************************/
   private static boolean isWideTableIntact(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement();
         ResultSet tables = statement.executeQuery("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PRF_WIDE'"))
      {
         tables.next();
         if(tables.getInt(1) == 0)
         {
            return false;
         }
      }
      try(Statement statement = connection.createStatement();
         ResultSet sums = statement.executeQuery("SELECT COUNT(*), SUM(" + fieldName(4) + "), MAX(name) FROM prf_wide"))
      {
         sums.next();
         return sums.getInt(1) == ROWS && sums.getLong(2) == expectedSum(4) && ("Row " + String.format("%05d", ROWS)).equals(sums.getString(3));
      }
   }



   /*******************************************************************************
    ** The sum of a count column over every row (see sqlValue()).
    *******************************************************************************/
   static long expectedSum(int column)
   {
      long total = 0;
      for(long id = 1; id <= ROWS; id++)
      {
         total += (id * column) % 1000;
      }
      return total;
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   static String fieldName(int column)
   {
      return KINDS[(column - 3) % KINDS.length] + String.format("%02d", column);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static String fieldLabel(int column)
   {
      String kind = KINDS[(column - 3) % KINDS.length];
      return Character.toUpperCase(kind.charAt(0)) + kind.substring(1) + " " + String.format("%02d", column);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QFieldType fieldType(int column)
   {
      return switch(KINDS[(column - 3) % KINDS.length])
      {
         case "text" -> QFieldType.STRING;
         case "count" -> QFieldType.INTEGER;
         case "amount" -> QFieldType.DECIMAL;
         case "day" -> QFieldType.DATE;
         case "moment" -> QFieldType.DATE_TIME;
         default -> QFieldType.BOOLEAN;
      };
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static String sqlType(int column)
   {
      return switch(KINDS[(column - 3) % KINDS.length])
      {
         case "text" -> "VARCHAR(40)";
         case "count" -> "INT";
         case "amount" -> "DECIMAL(12, 2)";
         case "day" -> "DATE";
         case "moment" -> "TIMESTAMP";
         default -> "BOOLEAN";
      };
   }



   /*******************************************************************************
    ** Deterministic cell value of row X in a column, mirrored by the specs.
    *******************************************************************************/
   private static String sqlValue(int column)
   {
      return switch(KINDS[(column - 3) % KINDS.length])
      {
         case "text" -> "'C" + column + "-' || X";
         case "count" -> "MOD(X * " + column + ", 1000)";
         case "amount" -> "CAST(MOD(X * " + column + ", 100000) AS DECIMAL(12, 2)) / 100";
         case "day" -> "DATEADD('DAY', MOD(X + " + column + ", 365), DATE '2025-01-01')";
         case "moment" -> "DATEADD('MINUTE', X * " + column + ", TIMESTAMP '2025-01-01 00:00:00')";
         default -> "MOD(X + " + column + ", 2) = 0";
      };
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static String widget(QInstance qInstance, String name, WidgetType type, String label, int gridColumns)
   {
      qInstance.addWidget(new QWidgetMetaData().withName(name).withType(type.getType()).withLabel(label).withIsCard(true)
         .withGridColumns(gridColumns).withCodeReference(new QCodeReference(PerformanceWidgetRenderer.class)));
      return name;
   }



   /*******************************************************************************
    ** Deterministic data for the dashboard widgets: the widget number n sets
    ** every value, so specs can compute what each widget shows.
    *******************************************************************************/
   public static class PerformanceWidgetRenderer extends AbstractWidgetRenderer
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public RenderWidgetOutput render(RenderWidgetInput input) throws QException
      {
         String      name   = input.getWidgetMetaData().getName();
         int         n      = Integer.parseInt(name.replaceAll("\\D", ""));
         QWidgetData data;
         if(name.startsWith("prfStatistics"))
         {
            data = new StatisticsData(n * 1000, new BigDecimal(n + ".5"), "vs last period");
         }
         else if(name.startsWith("prfTable"))
         {
            List<TableData.Column> columns = new ArrayList<>();
            for(int c = 1; c <= 6; c++)
            {
               columns.add(new TableData.Column("default", "Column " + c, "c" + c, "1fr", "left"));
            }
            List<Map<String, Object>> rows = new ArrayList<>();
            for(int r = 1; r <= 100; r++)
            {
               Map<String, Object> row = new LinkedHashMap<>();
               for(int c = 1; c <= 6; c++)
               {
                  row.put("c" + c, "T" + n + " R" + r + " C" + c);
               }
               rows.add(row);
            }
            data = new TableData("Table " + n, columns, rows);
         }
         else
         {
            int          points = name.startsWith("prfLine") ? 60 : name.startsWith("prfPie") ? 6 : 12;
            List<String> labels = new ArrayList<>();
            List<Number> values = new ArrayList<>();
            for(int p = 1; p <= points; p++)
            {
               labels.add("P" + p);
               values.add((n * 7 + p * 13) % 50 + 1);
            }
            data = new ChartData(input.getWidgetMetaData().getLabel(), null, "Series " + n, labels, values).withHeight(220);
         }
         return new RenderWidgetOutput(data);
      }
   }



   /*******************************************************************************
    ** Walks every prfWide row in pages of 250, reporting progress after each page
    ** (pausing pauseMillis per page so the job runs long enough to poll).
    *******************************************************************************/
   public static class WalkRowsStep implements BackendStep
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         long started = System.currentTimeMillis();
         int  pause   = Objects.requireNonNullElse(input.getValueInteger("pauseMillis"), 250);
         int  rows  = 0;
         long total = 0;
         try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend());
            PreparedStatement page = connection.prepareStatement("SELECT " + fieldName(4) + " FROM prf_wide WHERE id > ? ORDER BY id LIMIT 250"))
         {
            for(int after = 0; after < ROWS; after += 250)
            {
               page.setInt(1, after);
               try(ResultSet resultSet = page.executeQuery())
               {
                  while(resultSet.next())
                  {
                     rows++;
                     total += resultSet.getLong(1);
                  }
               }
               input.getAsyncJobCallback().updateStatus("Walked " + rows + " of " + ROWS + " rows", rows, ROWS);
               Thread.sleep(pause);
            }
            ////////////////////////////////////////////////////////////////////////
            // epoch millis, so a spec can time the UI against the job's own end //
            ////////////////////////////////////////////////////////////////////////
            try(PreparedStatement log = connection.prepareStatement("INSERT INTO prf_run_log (row_count, count_total, started_millis, finished_millis) VALUES (?, ?, ?, ?)"))
            {
               log.setInt(1, rows);
               log.setLong(2, total);
               log.setLong(3, started);
               log.setLong(4, System.currentTimeMillis());
               log.executeUpdate();
            }
         }
         catch(InterruptedException e)
         {
            Thread.currentThread().interrupt();
            throw new QException("Interrupted while walking rows");
         }
         catch(Exception e)
         {
            throw new QException("Could not walk the performance rows", e);
         }
         output.addValue("rowCount", rows);
         output.addValue("countTotal", total);
      }
   }
}
