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

import java.io.Serializable;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.ChildRecordListRenderer;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.RowBuilderWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.tables.DeleteAction;
import com.kingsrook.qqq.backend.core.actions.tables.InsertAction;
import com.kingsrook.qqq.backend.core.context.QContext;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.actions.tables.delete.DeleteInput;
import com.kingsrook.qqq.backend.core.model.actions.tables.insert.InsertInput;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QCriteriaOperator;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QFilterCriteria;
import com.kingsrook.qqq.backend.core.model.actions.tables.query.QQueryFilter;
import com.kingsrook.qqq.backend.core.model.data.QRecord;
import com.kingsrook.qqq.backend.core.model.metadata.QBackendMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinOn;
import com.kingsrook.qqq.backend.core.model.metadata.joins.JoinType;
import com.kingsrook.qqq.backend.core.model.metadata.joins.QJoinMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.DenyBehavior;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.metadata.possiblevalues.QPossibleValueSource;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Association;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Capability;
import com.kingsrook.qqq.backend.core.model.metadata.tables.ExposedJoin;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QFieldSection;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Tier;
import com.kingsrook.qqq.backend.core.model.metadata.tables.UniqueKey;
import com.kingsrook.qqq.backend.core.model.metadata.variants.BackendVariantsConfig;
import com.kingsrook.qqq.backend.core.model.session.QSession;
import com.kingsrook.qqq.backend.core.modules.backend.implementations.memory.MemoryBackendModule;
import com.kingsrook.qqq.backend.core.modules.backend.implementations.memory.MemoryModuleBackendVariantSetting;
import com.kingsrook.qqq.backend.core.processes.implementations.columnstats.ColumnStatsStep;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.qqq.frontend.materialdashboard.model.metadata.MaterialDashboardTableMetaData;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Query matrix area. Everything
 ** here is synthetic, QRun-owned test data layered on the stock sample; the
 ** stock sample tables are left untouched so other areas are unaffected.
 **
 ** - qryItem: one field of every filterable type, a table and an enum possible
 **   value source, an exposed one-side join (Person) and an exposed many-side
 **   join (Item Note), with column statistics enabled.
 ** - qryStock: a memory table on a backend with variants (qryStore options).
 ** - qryLedger: a queryable table with count, export and writes disabled.
 ** - qryHousehold / qryMember: canonical, aliased and composite (non primary
 **   key) associations, bound to childRecordList and rowBuilder widgets.
 ** - qryBin: Material "Go To" keys (code; aisle + shelf); qryLocker: readable by
 **   key (GET) but not queryable, so its query screen opens Go To.
 *******************************************************************************/
final class QueryFixtures
{
   static final String VARIANT_TYPE = "qryStore";

   private static volatile QInstance instance;



   private QueryFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (tables, fields, processes, widgets, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance qInstance) throws QException
   {
      instance = qInstance;
      String rdbms = SampleMetaDataProvider.RDBMS_BACKEND_NAME;

      ///////////////////////////////////////////////////////
      // operator lab, joins and column statistics (qryItem) //
      ///////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryItem").withLabel("Query Item").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("code", QFieldType.STRING))
         .withField(new QFieldMetaData("quantity", QFieldType.INTEGER))
         .withField(new QFieldMetaData("price", QFieldType.DECIMAL))
         .withField(new QFieldMetaData("receivedDate", QFieldType.DATE))
         .withField(new QFieldMetaData("checkedAt", QFieldType.DATE_TIME))
         .withField(new QFieldMetaData("isActive", QFieldType.BOOLEAN))
         .withField(new QFieldMetaData("ownerId", QFieldType.INTEGER).withLabel("Owner").withPossibleValueSourceName(SampleMetaDataProvider.TABLE_NAME_PERSON))
         .withField(new QFieldMetaData("speciesId", QFieldType.INTEGER).withLabel("Species").withPossibleValueSourceName("petSpecies"))
         .withField(new QFieldMetaData("notes", QFieldType.TEXT))
         .withField(new QFieldMetaData("photo", QFieldType.BLOB))
         .withCapability(Capability.QUERY_STATS)
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name", "code")))
         .withSection(new QFieldSection("details", "Details", new QIcon("dataset"), Tier.T2,
            List.of("quantity", "price", "receivedDate", "checkedAt", "isActive", "ownerId", "speciesId", "notes", "photo")))
         .withExposedJoin(new ExposedJoin().withJoinTable(SampleMetaDataProvider.TABLE_NAME_PERSON).withJoinPath(List.of("qryItemJoinPerson")))
         .withExposedJoin(new ExposedJoin().withJoinTable("qryItemNote").withJoinPath(List.of("qryItemJoinItemNote")))));
      //////////////////////////////////////////////////////////////////////////////////////////////
      // default grid column order (Material): fields declared out of order, sections decide (#714) //
      //////////////////////////////////////////////////////////////////////////////////////////////
      QTableMetaData ordered = new QTableMetaData().withName("qryOrdered").withLabel("Ordered Item").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("price", QFieldType.DECIMAL))
         .withField(new QFieldMetaData("quantity", QFieldType.INTEGER))
         .withField(new QFieldMetaData("code", QFieldType.STRING))
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("badge"), Tier.T1, List.of("id", "name", "code")))
         .withSection(new QFieldSection("details", "Details", new QIcon("dataset"), Tier.T2, List.of("price")))
         .withSection(new QFieldSection("stock", "Stock", new QIcon("inventory"), Tier.T2, List.of("quantity")));
      ordered.setBackendDetails(new RDBMSTableBackendDetails().withTableName("qry_item"));
      QInstanceEnricher.setInferredFieldBackendNames(ordered);
      qInstance.addTable(ordered);

      ////////////////////////////////////////////////////////////////////////////
      // more than a thousand rows: pagination numbers are locale formatted (#714) //
      ////////////////////////////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryManyRow").withLabel("Many Row").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING))));

      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryItemNote").withLabel("Item Note").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("note")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("itemId", QFieldType.INTEGER).withLabel("Item").withIsRequired(true).withPossibleValueSourceName("qryItem"))
         .withField(new QFieldMetaData("note", QFieldType.STRING).withIsRequired(true))));
      qInstance.addPossibleValueSource(QPossibleValueSource.newForTable("qryItem"));
      qInstance.addJoin(new QJoinMetaData().withName("qryItemJoinPerson").withLeftTable("qryItem").withRightTable(SampleMetaDataProvider.TABLE_NAME_PERSON)
         .withType(JoinType.MANY_TO_ONE).withJoinOn(new JoinOn("ownerId", "id")));
      qInstance.addJoin(new QJoinMetaData().withName("qryItemJoinItemNote").withLeftTable("qryItem").withRightTable("qryItemNote")
         .withType(JoinType.ONE_TO_MANY).withJoinOn(new JoinOn("id", "itemId")));
      if(qInstance.getProcess("columnStats") == null)
      {
         qInstance.addProcess(ColumnStatsStep.getProcessMetaData());
      }

      ////////////////////////////////////////////////////////////
      // table variants: a memory backend keyed by qryStore rows //
      ////////////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName(VARIANT_TYPE).withLabel("Store").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))));
      qInstance.addBackend(new QBackendMetaData().withName("qryVariantMemory").withBackendType(MemoryBackendModule.class)
         .withUsesVariants(true)
         .withBackendVariantsConfig(new BackendVariantsConfig().withVariantTypeKey(VARIANT_TYPE).withOptionsTableName(VARIANT_TYPE)
            .withBackendSettingSourceFieldName(MemoryModuleBackendVariantSetting.PRIMARY_KEY, "id")));
      qInstance.addTable(new QTableMetaData().withName("qryStock").withLabel("Stock").withBackendName("qryVariantMemory")
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("sku")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("sku", QFieldType.STRING).withLabel("SKU").withIsRequired(true))
         .withField(new QFieldMetaData("quantity", QFieldType.INTEGER)));

      ///////////////////////////////////////////////////////
      // a table whose capabilities exclude writes/count/export //
      ///////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryLedger").withLabel("Ledger").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("entry")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("entry", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("amount", QFieldType.DECIMAL))
         .withoutCapabilities(Capability.TABLE_INSERT, Capability.TABLE_UPDATE, Capability.TABLE_DELETE, Capability.TABLE_EXPORT, Capability.TABLE_COUNT)));

      /////////////////////////////////////////////////////////////////////
      // households: canonical, aliased and composite member associations //
      /////////////////////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryHousehold").withLabel("Household").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("code", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("reviewDate", QFieldType.DATE))
         .withSection(new QFieldSection("identity", "Identity", new QIcon("home"), Tier.T1, List.of("id", "name", "code", "reviewDate")))));
      qInstance.addPossibleValueSource(QPossibleValueSource.newForTable("qryHousehold"));
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryMember").withLabel("Member").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("householdId", QFieldType.INTEGER).withLabel("Household").withPossibleValueSourceName("qryHousehold"))
         .withField(new QFieldMetaData("householdCode", QFieldType.STRING))
         .withField(new QFieldMetaData("reviewDate", QFieldType.DATE))));
      QJoinMetaData members = new QJoinMetaData().withName("qryHouseholdJoinMember").withLeftTable("qryHousehold").withRightTable("qryMember")
         .withType(JoinType.ONE_TO_MANY).withJoinOn(new JoinOn("id", "householdId"));
      qInstance.addJoin(members);
      qInstance.addJoin(new QJoinMetaData().withName("qryHouseholdScheduledMember").withLeftTable("qryHousehold").withRightTable("qryMember")
         .withType(JoinType.ONE_TO_MANY).withJoinOn(new JoinOn("code", "householdCode")).withJoinOn(new JoinOn("reviewDate", "reviewDate")));
      QTableMetaData household = qInstance.getTable("qryHousehold");
      household.withAssociation(new Association().withName("members").withAssociatedTableName("qryMember").withJoinName(members.getName()));
      household.withAssociation(new Association().withName("care group / primary").withAssociatedTableName("qryMember").withJoinName(members.getName()));
      household.withAssociation(new Association().withName("scheduled reviews").withAssociatedTableName("qryMember").withJoinName("qryHouseholdScheduledMember"));
      qInstance.addWidget(ChildRecordListRenderer.widgetMetaDataBuilder(members)
         .withName("qryCompanionPanel").withLabel("Companions").withManageAssociationName("care group / primary").getWidgetMetaData());
      qInstance.addWidget(RowBuilderWidgetRenderer.widgetMetaDataBuilder("qryReviewEditor").withLabel("Review Schedule")
         .withAssociationName("scheduled reviews").withParentTableName("qryHousehold")
         .withIsForRecordViewAndEditScreen(true).withFields(List.of(qInstance.getTable("qryMember").getField("name"))).getWidgetMetaData());
      household.withSection(new QFieldSection().withName("companions").withLabel("Companions").withTier(Tier.T2).withWidgetName("qryCompanionPanel"));
      household.withSection(new QFieldSection().withName("reviewSchedule").withLabel("Review Schedule").withTier(Tier.T2).withWidgetName("qryReviewEditor"));

      //////////////////////////////////////////////////////////////////////////////
      // Material "Go To": the primary key plus two unique keys (code; aisle+shelf) //
      //////////////////////////////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryBin").withLabel("Storage Bin").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("contents")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("code", QFieldType.STRING).withLabel("Bin Code").withIsRequired(true))
         .withField(new QFieldMetaData("aisle", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("shelf", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("contents", QFieldType.STRING))
         .withUniqueKey(new UniqueKey("code"))
         .withUniqueKey(new UniqueKey("aisle", "shelf"))
         .withSupplementalMetaData(new MaterialDashboardTableMetaData().withGotoFieldNames(List.of(List.of("code"), List.of("aisle", "shelf"))))));
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryLocker").withLabel("Locker").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("holder")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("code", QFieldType.STRING).withLabel("Locker Code").withIsRequired(true))
         .withField(new QFieldMetaData("holder", QFieldType.STRING))
         .withUniqueKey(new UniqueKey("code"))
         .withoutCapabilities(Capability.TABLE_QUERY)
         .withSupplementalMetaData(new MaterialDashboardTableMetaData().withGotoFieldNames(List.of(List.of("code"))))));

      ////////////////////////////////////////////////////////////////////////////////////
      // a readable parent whose associated table is denied to noPets with DISABLED: the //
      // child stays listed in metadata (readPermission false), so its panel is kept.    //
      // (Tables denied with HIDDEN, like the sample pet table, are absent instead.)     //
      ////////////////////////////////////////////////////////////////////////////////////
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryShelter").withLabel("Shelter").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))));
      qInstance.addTable(rdbmsTable(new QTableMetaData().withName("qryShelterPet").withLabel("Shelter Pet").withBackendName(rdbms)
         .withPrimaryKeyField("id").withRecordLabelFormat("%s").withRecordLabelFields("name")
         .withPermissionRules(new QPermissionRules().withLevel(PermissionLevel.READ_INSERT_EDIT_DELETE_PERMISSIONS)
            .withPermissionBaseName("pet").withDenyBehavior(DenyBehavior.DISABLED))
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withIsEditable(false))
         .withField(new QFieldMetaData("name", QFieldType.STRING).withIsRequired(true))
         .withField(new QFieldMetaData("shelterId", QFieldType.INTEGER).withLabel("Shelter"))));
      QJoinMetaData shelterPets = new QJoinMetaData().withName("qryShelterJoinShelterPet").withLeftTable("qryShelter").withRightTable("qryShelterPet")
         .withType(JoinType.ONE_TO_MANY).withJoinOn(new JoinOn("id", "shelterId"));
      qInstance.addJoin(shelterPets);
      qInstance.getTable("qryShelter").withAssociation(new Association().withName("pets").withAssociatedTableName("qryShelterPet").withJoinName(shelterPets.getName()));
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
            "DROP TABLE IF EXISTS qry_item_note",
            "DROP TABLE IF EXISTS qry_item",
            "DROP TABLE IF EXISTS qry_many_row",
            "CREATE TABLE qry_many_row (id INT PRIMARY KEY, name VARCHAR(40) NOT NULL)",
            "INSERT INTO qry_many_row (id, name) SELECT X, CONCAT('Row ', X) FROM SYSTEM_RANGE(1, 1234)",
            """
               CREATE TABLE qry_item (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL, code VARCHAR(40), quantity INT, price DECIMAL(12, 2),
               received_date DATE, checked_at TIMESTAMP, is_active BOOLEAN, owner_id INT, species_id INT, notes VARCHAR(1000), photo BLOB)""",
            //////////////////////////////////////////////////////////////////////////////////////////
            // dates are relative to the reset, so relative date expressions have stable answers //
            //////////////////////////////////////////////////////////////////////////////////////////
            """
               INSERT INTO qry_item VALUES
               (1, 'Alpha Widget', 'AW-1', 10, 1.50, DATEADD('DAY', -3, CURRENT_DATE), DATEADD('HOUR', -2, LOCALTIMESTAMP), TRUE, 1, 1, 'first shipment', X'00FF'),
               (2, 'Beta Gadget', 'BG-2', 25, 19.99, DATEADD('DAY', -40, CURRENT_DATE), DATEADD('DAY', -50, LOCALTIMESTAMP), FALSE, 2, 2, 'fragile', NULL),
               (3, 'Gamma Widget', 'GW-3', 0, 5.00, DATEADD('DAY', 10, CURRENT_DATE), DATEADD('DAY', 3, LOCALTIMESTAMP), TRUE, 1, 1, NULL, NULL),
               (4, 'Delta Tool', NULL, NULL, 250.00, NULL, NULL, NULL, NULL, NULL, 'no owner', NULL),
               (5, 'Epsilon Widget Pro', 'EW-5', 100, 0.99, DATE '2020-06-15', TIMESTAMP '2020-06-15 12:00:00', FALSE, 3, 2, NULL, NULL),
               (6, 'Zeta gear', 'zg-6', 7, 7.77, CURRENT_DATE, DATEADD('MINUTE', -30, LOCALTIMESTAMP), TRUE, 5, 1, 'lowercase code', NULL),
               (7, '100% Cotton', 'C_7', 3, 12.00, DATE '2021-01-01', TIMESTAMP '2021-01-01 08:30:00', FALSE, 4, 2, 'percent_sign', NULL),
               (8, 'Omega Part', 'OP-8', 55, 55.55, DATEADD('DAY', -400, CURRENT_DATE), DATEADD('DAY', -400, LOCALTIMESTAMP), TRUE, 2, 1, NULL, NULL)""",
            "CREATE TABLE qry_item_note (id INT PRIMARY KEY, item_id INT NOT NULL, note VARCHAR(80) NOT NULL)",
            "INSERT INTO qry_item_note VALUES (1, 1, 'Checked in'), (2, 1, 'Recounted'), (3, 2, 'Damaged box')",

            "DROP TABLE IF EXISTS qry_store",
            "CREATE TABLE qry_store (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL)",
            "INSERT INTO qry_store VALUES (1, 'North Store'), (2, 'South Store'), (3, 'Empty Store')",

            "DROP TABLE IF EXISTS qry_ledger",
            "CREATE TABLE qry_ledger (id INT PRIMARY KEY, entry VARCHAR(80) NOT NULL, amount DECIMAL(12, 2))",
            "INSERT INTO qry_ledger VALUES (1, 'Opening balance', 100.00), (2, 'Supplies', -12.50), (3, 'Refund', 4.25)",

            "DROP TABLE IF EXISTS qry_member",
            "DROP TABLE IF EXISTS qry_household",
            "CREATE TABLE qry_household (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, code VARCHAR(10) NOT NULL, review_date DATE)",
            "INSERT INTO qry_household (id, name, code, review_date) VALUES (1, 'Maple House', 'MH', DATE '2026-03-01'), (2, 'Cedar House', 'CH', DATE '2026-04-01'), (3, 'Empty House', 'EH', NULL)",
            "ALTER TABLE qry_household ALTER COLUMN id RESTART WITH 100",
            "CREATE TABLE qry_member (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL, household_id INT, household_code VARCHAR(10), review_date DATE)",
            //////////////////////////////////////////////////////////////////////////////////////////
            // Ari belongs to Maple by id but matches Cedar's composite (code, review date) join; //
            // Di belongs to Cedar by id and matches no composite join.                          //
            //////////////////////////////////////////////////////////////////////////////////////////
            """
               INSERT INTO qry_member (id, name, household_id, household_code, review_date) VALUES
               (1, 'Ari', 1, 'CH', DATE '2026-04-01'), (2, 'Bo', 1, 'MH', DATE '2026-03-01'),
               (3, 'Cy', 2, 'CH', DATE '2026-04-01'), (4, 'Di', 2, 'MH', DATE '2025-01-01')""",
            "ALTER TABLE qry_member ALTER COLUMN id RESTART WITH 100",

            "DROP TABLE IF EXISTS qry_bin",
            "CREATE TABLE qry_bin (id INT PRIMARY KEY, code VARCHAR(20) NOT NULL, aisle VARCHAR(10) NOT NULL, shelf VARCHAR(10) NOT NULL, contents VARCHAR(80))",
            "INSERT INTO qry_bin VALUES (1, 'B-100', 'A', '1', 'Bolts'), (2, 'B-200', 'A', '2', 'Nuts'), (3, 'B-300', 'B', '1', 'Washers'), (4, 'B-400', 'C', '1', 'Screws')",
            "DROP TABLE IF EXISTS qry_locker",
            "CREATE TABLE qry_locker (id INT PRIMARY KEY, code VARCHAR(20) NOT NULL, holder VARCHAR(80))",
            "INSERT INTO qry_locker VALUES (1, 'L-01', 'Ari Locker'), (2, 'L-02', 'Bo Locker')",

            "DROP TABLE IF EXISTS qry_shelter_pet",
            "DROP TABLE IF EXISTS qry_shelter",
            "CREATE TABLE qry_shelter (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL)",
            "INSERT INTO qry_shelter VALUES (1, 'Harbor Shelter')",
            "CREATE TABLE qry_shelter_pet (id INT PRIMARY KEY, name VARCHAR(80) NOT NULL, shelter_id INT)",
            "INSERT INTO qry_shelter_pet VALUES (1, 'Charlie', 1), (2, 'Biscuit', 1)",

            ////////////////////////////////////////////////////////////////////////////
            // share the stock sample's "Alice People View" read-only with bob //
            ////////////////////////////////////////////////////////////////////////////
            "DELETE FROM shared_saved_view WHERE user_id = 'sample:bob'",
            "INSERT INTO shared_saved_view (create_date, modify_date, saved_view_id, user_id, scope) SELECT NOW(), NOW(), id, 'sample:bob', 'READ_ONLY' FROM saved_view WHERE label = 'Alice People View'"))
         {
            statement.execute(sql);
         }
      }
      primeVariantStock();
   }



   /*******************************************************************************
    ** Memory-backend rows differ per store variant; replace them on every reset.
    *******************************************************************************/
   private static void primeVariantStock() throws QException
   {
      Map<Integer, List<QRecord>> stock = Map.of(
         1, List.of(stockRecord(1, "N-APPLE", 5), stockRecord(2, "N-PEAR", 8)),
         2, List.of(stockRecord(1, "S-KIWI", 13)),
         3, List.of());
      try
      {
         for(Map.Entry<Integer, List<QRecord>> entry : stock.entrySet())
         {
            QContext.init(instance, new QSession().withBackendVariants(Map.of(VARIANT_TYPE, (Serializable) entry.getKey())));
            new DeleteAction().execute(new DeleteInput("qryStock")
               .withQueryFilter(new QQueryFilter(new QFilterCriteria("id", QCriteriaOperator.IS_NOT_BLANK))));
            if(!entry.getValue().isEmpty())
            {
               new InsertAction().execute(new InsertInput("qryStock").withRecords(entry.getValue()));
            }
         }
      }
      finally
      {
         QContext.clear();
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QRecord stockRecord(int id, String sku, int quantity)
   {
      return new QRecord().withValue("id", id).withValue("sku", sku).withValue("quantity", quantity);
   }



   /*******************************************************************************
    ** Snake-case table and column names, like the stock sample.
    *******************************************************************************/
   private static QTableMetaData rdbmsTable(QTableMetaData table)
   {
      table.setBackendDetails(new RDBMSTableBackendDetails().withTableName(QInstanceEnricher.inferBackendName(table.getName())));
      QInstanceEnricher.setInferredFieldBackendNames(table);
      return table;
   }
}
