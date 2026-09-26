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
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.branding.Banner;
import com.kingsrook.qqq.backend.core.model.metadata.branding.QBrandingMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportDataSource;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportField;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.QReportView;
import com.kingsrook.qqq.backend.core.model.metadata.reporting.ReportType;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Capability;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.UniqueKey;
import com.kingsrook.qqq.backend.core.model.savedviews.SavedView;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.MaterialDashboardAppMetaData;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.MaterialDashboardBannerSlots;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Navigation matrix area. Everything
 ** here is synthetic, QRun-owned test data layered on the stock sample:
 **
 ** - a three-level nested app (Nav Level One > Two > Three) holding a table,
 **   to prove nesting deeper than the sample's two levels;
 ** - a hidden table whose permission rules are NOT_PROTECTED, so it is hidden
 **   from navigation but still reachable by direct link (hidden is not denied);
 ** - a report as an app child, so REPORT app-tree nodes are navigable;
 ** - an app with no children, sections or widgets (empty app home);
 ** - branding extras the stock sample lacks: accent color and one banner per
 **   supported slot;
 ** - record search (QRun-IO/qqq#701): search fields on the sample's person
 **   (name, email) and pet (name) tables and on saved views (label; locked to
 **   their owner). The security variant declares none, so it has no search.
 *******************************************************************************/
final class NavigationFixtures
{
   static final String APP_LEVEL_ONE   = "navLevelOne";
   static final String APP_LEVEL_TWO   = "navLevelTwo";
   static final String APP_LEVEL_THREE = "navLevelThree";
   static final String APP_EMPTY       = "navEmptyApp";
   static final String TABLE_DEEP      = "navDeepItem";
   static final String TABLE_HIDDEN    = "navHiddenNote";
   static final String REPORT_DEEP     = "navDeepItemReport";
   static final String APP_QUIET       = "navQuietHome";
   static final String TABLE_QUIET     = "navQuietItem";

   static final String ACCENT_COLOR = "#1d4ed8";



   /*******************************************************************************
    **
    *******************************************************************************/
   private NavigationFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (tables, fields, processes, widgets, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance instance)
   {
      instance.getTable(SampleMetaDataProvider.TABLE_NAME_PERSON).withSearchFields("firstName", "lastName", "email");
      instance.getTable(SampleMetaDataProvider.TABLE_NAME_PET).withSearchFields("name");
      instance.getTable(SavedView.TABLE_NAME).withSearchFields("label");

      QTableMetaData deepItem = new QTableMetaData()
         .withName(TABLE_DEEP)
         .withLabel("Nav Deep Item")
         .withIcon(new QIcon("inventory_2"))
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withBackendDetails(new RDBMSTableBackendDetails().withTableName("nav_deep_item"))
         .withPrimaryKeyField("id")
         .withRecordLabelFormat("%s")
         .withRecordLabelFields("name")
         .withUniqueKey(new UniqueKey("code"))
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id").withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withLabel("Name").withIsRequired(true))
         .withField(new QFieldMetaData("code", QFieldType.STRING).withLabel("Code").withIsRequired(true))
         .withField(new QFieldMetaData("shelf", QFieldType.STRING).withLabel("Shelf"));
      instance.addTable(deepItem);

      QTableMetaData hiddenNote = new QTableMetaData()
         .withName(TABLE_HIDDEN)
         .withLabel("Nav Hidden Note")
         .withIsHidden(true)
         .withPermissionRules(new QPermissionRules().withLevel(PermissionLevel.NOT_PROTECTED))
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withBackendDetails(new RDBMSTableBackendDetails().withTableName("nav_hidden_note"))
         .withPrimaryKeyField("id")
         .withRecordLabelFormat("%s")
         .withRecordLabelFields("title")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id").withIsEditable(false))
         .withField(new QFieldMetaData("title", QFieldType.STRING).withLabel("Title").withIsRequired(true));
      instance.addTable(hiddenNote);

      QReportMetaData report = new QReportMetaData()
         .withName(REPORT_DEEP)
         .withLabel("Nav Deep Item Report")
         .withIcon(new QIcon("assessment"))
         .withDataSource(new QReportDataSource().withSourceTable(TABLE_DEEP))
         .withView(new QReportView()
            .withName("items")
            .withLabel("Items")
            .withType(ReportType.TABLE)
            .withColumns(List.of(new QReportField("id"), new QReportField("name"), new QReportField("code"))));
      instance.addReport(report);

      QAppMetaData levelThree = new QAppMetaData()
         .withName(APP_LEVEL_THREE)
         .withLabel("Nav Level Three")
         .withIcon(new QIcon("layers"))
         .withChild(deepItem)
         .withChild(hiddenNote)
         .withChild(report);
      QAppMetaData levelTwo = new QAppMetaData()
         .withName(APP_LEVEL_TWO)
         .withLabel("Nav Level Two")
         .withIcon(new QIcon("folder").withColor("#b91c1c"))
         .withChild(levelThree);
      QAppMetaData levelOne = new QAppMetaData()
         .withName(APP_LEVEL_ONE)
         .withLabel("Nav Level One")
         .withIcon(new QIcon().withPath("/kr-icon.png"))
         .withChild(levelTwo);
      instance.addApp(levelThree);
      instance.addApp(levelTwo);
      instance.addApp(levelOne);

      instance.addApp(new QAppMetaData()
         .withName(APP_EMPTY)
         .withLabel("Nav Empty App")
         .withIcon(new QIcon("inbox")));

      ////////////////////////////////////////////////////////////////////////////////////////////////
      // Material app settings: a home screen without its label and without table counts (#714). //
      // navQuietItem reads the nav_deep_item rows under its own name.                              //
      ////////////////////////////////////////////////////////////////////////////////////////////////
      instance.addTable(new QTableMetaData()
         .withName(TABLE_QUIET)
         .withLabel("Nav Quiet Item")
         .withoutCapability(Capability.TABLE_INSERT).withoutCapability(Capability.TABLE_UPDATE).withoutCapability(Capability.TABLE_DELETE)
         .withIcon(new QIcon("inventory"))
         .withBackendName(SampleMetaDataProvider.RDBMS_BACKEND_NAME)
         .withBackendDetails(new RDBMSTableBackendDetails().withTableName("nav_deep_item"))
         .withPrimaryKeyField("id")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id").withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withLabel("Name")));
      instance.addApp(new QAppMetaData()
         .withName(APP_QUIET)
         .withLabel("Nav Quiet Home")
         .withIcon(new QIcon("do_not_disturb"))
         .withChild(instance.getTable(TABLE_QUIET))
         .withSupplementalMetaData(new MaterialDashboardAppMetaData()
            .withShowAppLabelOnHomeScreen(false)
            .withIncludeTableCountsOnHomeScreen(false)));

      QBrandingMetaData branding = instance.getBranding();
      branding.withAccentColor(ACCENT_COLOR);
      branding.withBanner(MaterialDashboardBannerSlots.QFMD_TOP_OF_SITE, new Banner()
         .withSeverity(Banner.Severity.INFO)
         .withMessageText("Acceptance site banner: synthetic QRun data"));
      branding.withBanner(MaterialDashboardBannerSlots.QFMD_TOP_OF_BODY, new Banner()
         .withSeverity(Banner.Severity.WARNING)
         .withMessageHTML("Acceptance body banner: <b>read the docs</b>"));
      branding.withBanner(MaterialDashboardBannerSlots.QFMD_SIDE_NAV_UNDER_LOGO, new Banner()
         .withSeverity(Banner.Severity.SUCCESS)
         .withTextColor("#ffffff")
         .withBackgroundColor("#14532d")
         .withAdditionalStyles(Map.of("fontWeight", "700"))
         .withMessageText("NAV FIXTURE"));
   }



   /*******************************************************************************
    ** Create and seed fixture tables; runs at startup and on every /acceptance/reset,
    ** after the stock prime-test-database.sql.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      try(Statement statement = connection.createStatement())
      {
         statement.execute("DROP TABLE IF EXISTS nav_deep_item");
         statement.execute("CREATE TABLE nav_deep_item (id INTEGER AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, code VARCHAR(40) NOT NULL UNIQUE, shelf VARCHAR(40))");
         statement.execute("INSERT INTO nav_deep_item (id, name, code, shelf) VALUES (1, 'Brass Compass', 'NAV-A1', 'North'), (2, 'Tide Chart', 'NAV-B2', 'East'), (3, 'Signal Lamp', 'NAV-C3', 'North')");
         statement.execute("ALTER TABLE nav_deep_item ALTER COLUMN id RESTART WITH 4");

         statement.execute("DROP TABLE IF EXISTS nav_hidden_note");
         statement.execute("CREATE TABLE nav_hidden_note (id INTEGER AUTO_INCREMENT PRIMARY KEY, title VARCHAR(100) NOT NULL)");
         statement.execute("INSERT INTO nav_hidden_note (id, title) VALUES (1, 'Hidden but reachable'), (2, 'Second hidden note')");
         statement.execute("ALTER TABLE nav_hidden_note ALTER COLUMN id RESTART WITH 3");
      }
   }
}
