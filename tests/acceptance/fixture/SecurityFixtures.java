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
import java.util.List;
import com.kingsrook.qqq.backend.core.actions.dashboard.widgets.NoCodeWidgetRenderer;
import com.kingsrook.qqq.backend.core.actions.processes.BackendStep;
import com.kingsrook.qqq.backend.core.actions.tables.InsertAction;
import com.kingsrook.qqq.backend.core.context.QContext;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.instances.QInstanceEnricher;
import com.kingsrook.qqq.backend.core.model.actions.processes.RunBackendStepInput;
import com.kingsrook.qqq.backend.core.model.actions.processes.RunBackendStepOutput;
import com.kingsrook.qqq.backend.core.model.actions.tables.insert.InsertInput;
import com.kingsrook.qqq.backend.core.model.dashboard.widgets.WidgetType;
import com.kingsrook.qqq.backend.core.model.data.QRecord;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.nocode.QNoCodeWidgetMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.dashboard.nocode.WidgetHtmlLine;
import com.kingsrook.qqq.backend.core.model.metadata.fields.AdornmentType;
import com.kingsrook.qqq.backend.core.model.metadata.fields.FieldAdornment;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.fields.QFieldType;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QAppSection;
import com.kingsrook.qqq.backend.core.model.metadata.layout.QIcon;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.DenyBehavior;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QBackendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QComponentType;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendComponentMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QFrontendStepMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.processes.QProcessMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.security.RecordSecurityLock;
import com.kingsrook.qqq.backend.core.model.metadata.tables.Capability;
import com.kingsrook.qqq.backend.core.model.metadata.tables.QTableMetaData;
import com.kingsrook.qqq.backend.module.rdbms.jdbc.QueryManager;
import com.kingsrook.qqq.backend.module.rdbms.model.metadata.RDBMSTableBackendDetails;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;
import com.kingsrook.sampleapp.metadata.SampleSharingMetaDataProvider;


/*******************************************************************************
 ** Acceptance fixture additions owned by the Security matrix area. Everything
 ** here is synthetic, QRun-owned test data layered on the stock sample.
 **
 ** The base personas are fixed by AcceptanceSampleServer, so restricted objects
 ** here reuse their permission names instead of adding personas:
 **  - `noPets` drops every `pet.*` permission, so objects whose permission base
 **    name is "pet" are denied to it (hidden or disabled per DenyBehavior);
 **  - `viewer` and `noProcesses` drop every Process permission;
 **  - `viewer` drops every `*.insert|edit|delete` permission.
 ** Record-level locks use the sample sharing demo's user security key, which
 ** the persona customizer sets to the sample user (alice, bob, casey).
 *******************************************************************************/
final class SecurityFixtures
{
   static final String APP              = "securityApp";
   static final String PET_APP          = "securityPetApp";
   static final String PET_DISABLED_APP = "securityPetDisabledApp";
   static final String LEDGER           = "securityLedger";
   static final String VAULT            = "securityVault";
   static final String NOTE             = "securityNote";
   static final String ARCHIVE          = "securityArchive";
   static final String AUDIT_LOG        = "securityAuditLog";
   static final String AUDIT_PROCESS    = "securityAudit";
   static final String OPEN_WIDGET      = "securityOpenWidget";
   static final String PET_WIDGET       = "securityPetWidget";
   static final String PET_DISABLED_WIDGET = "securityPetDisabledWidget";

   private static final String BACKEND = SampleMetaDataProvider.RDBMS_BACKEND_NAME;



   private SecurityFixtures()
   {
   }



   /*******************************************************************************
    ** Add metadata (tables, fields, processes, widgets, apps) to the sample instance.
    *******************************************************************************/
   static void define(QInstance instance)
   {
      ///////////////////////////////////////////////////////////////////////////
      // read and write guarded by the "pet" permission names, disabled on deny //
      ///////////////////////////////////////////////////////////////////////////
      instance.addTable(table(LEDGER, "Security Ledger", "security_ledger")
         .withPermissionRules(petRules(DenyBehavior.DISABLED))
         .withRecordLabelFormat("%s").withRecordLabelFields("entryName")
         .withField(new QFieldMetaData("entryName", QFieldType.STRING).withLabel("Entry Name"))
         .withField(new QFieldMetaData("amount", QFieldType.DECIMAL).withLabel("Amount")));

      //////////////////////////////////////////////////////
      // hidden, heavy and password fields on a plain table //
      //////////////////////////////////////////////////////
      instance.addTable(table(VAULT, "Security Vault", "security_vault")
         .withRecordLabelFormat("%s").withRecordLabelFields("label")
         .withField(new QFieldMetaData("label", QFieldType.STRING).withLabel("Label"))
         .withField(new QFieldMetaData("vaultNote", QFieldType.STRING).withLabel("Vault Note").withIsHidden(true))
         .withField(new QFieldMetaData("accessCode", QFieldType.PASSWORD).withLabel("Access Code"))
         .withField(new QFieldMetaData("revealCode", QFieldType.PASSWORD).withLabel("Reveal Code")
            .withFieldAdornment(new FieldAdornment(AdornmentType.REVEAL)))
         .withField(new QFieldMetaData("payload", QFieldType.BLOB).withLabel("Payload").withIsHeavy(true)));

      ////////////////////////////////////////////////////
      // record-level lock on the sample user's identity //
      ////////////////////////////////////////////////////
      instance.addTable(table(NOTE, "Security Note", "security_note")
         .withRecordLabelFormat("%s").withRecordLabelFields("title")
         .withRecordSecurityLock(new RecordSecurityLock()
            .withSecurityKeyType(SampleSharingMetaDataProvider.USER_KEY)
            .withFieldName("ownerId"))
         .withField(new QFieldMetaData("title", QFieldType.STRING).withLabel("Title"))
         .withField(new QFieldMetaData("body", QFieldType.STRING).withLabel("Body"))
         .withField(new QFieldMetaData("ownerId", QFieldType.STRING).withLabel("Owner")));

      /////////////////////////////////////////////////////
      // capability restriction: read-only by table design //
      /////////////////////////////////////////////////////
      instance.addTable(table(ARCHIVE, "Security Archive", "security_archive")
         .withoutCapabilities(Capability.TABLE_INSERT, Capability.TABLE_UPDATE, Capability.TABLE_DELETE)
         .withRecordLabelFormat("%s").withRecordLabelFields("title")
         .withField(new QFieldMetaData("title", QFieldType.STRING).withLabel("Title")));

      instance.addTable(table(AUDIT_LOG, "Security Audit Log", "security_audit_log")
         .withRecordLabelFormat("%s").withRecordLabelFields("message")
         .withField(new QFieldMetaData("message", QFieldType.STRING).withLabel("Message")));

      ///////////////////////////////////////////////////////////////////////////////
      // a process that mutates data; disabled (not hidden) for users without access //
      ///////////////////////////////////////////////////////////////////////////////
      instance.addProcess(new QProcessMetaData()
         .withName(AUDIT_PROCESS)
         .withLabel("Security Audit")
         .withIcon(new QIcon("policy"))
         .withPermissionRules(new QPermissionRules().withLevel(PermissionLevel.HAS_ACCESS_PERMISSION).withDenyBehavior(DenyBehavior.DISABLED))
         .withStep(new QBackendStepMetaData()
            .withName("record")
            .withCode(new QCodeReference(RecordAuditStep.class)))
         .withStep(new QFrontendStepMetaData()
            .withName("done")
            .withComponent(new QFrontendComponentMetaData().withType(QComponentType.VIEW_FORM))
            .withViewField(new QFieldMetaData("auditMessage", QFieldType.STRING).withLabel("Audit Message"))));

      instance.addWidget(htmlWidget(OPEN_WIDGET, "Security Bulletin", "Bulletin for every user", null));
      instance.addWidget(htmlWidget(PET_WIDGET, "Pet Secrets", "Pet-only secret content", petRules(DenyBehavior.HIDDEN)));
      instance.addWidget(htmlWidget(PET_DISABLED_WIDGET, "Pet Disabled Secrets", "Pet-only disabled content", petRules(DenyBehavior.DISABLED)));

      instance.addApp(new QAppMetaData()
         .withName(APP)
         .withLabel("Security Center")
         .withIcon(new QIcon("security"))
         .withSortOrder(900)
         .withWidgets(List.of(OPEN_WIDGET, PET_WIDGET, PET_DISABLED_WIDGET))
         .withChild(instance.getTable(LEDGER))
         .withChild(instance.getTable(VAULT))
         .withChild(instance.getTable(NOTE))
         .withChild(instance.getTable(ARCHIVE))
         .withChild(instance.getTable(AUDIT_LOG))
         .withChild(instance.getProcess(AUDIT_PROCESS))
         .withSection(new QAppSection().withName("securityData").withLabel("Security Data")
            .withTables(List.of(LEDGER, VAULT, NOTE, ARCHIVE, AUDIT_LOG))
            .withProcesses(List.of(AUDIT_PROCESS))));

      instance.addApp(new QAppMetaData()
         .withName(PET_APP)
         .withLabel("Pet Vault App")
         .withIcon(new QIcon("lock"))
         .withSortOrder(901)
         .withPermissionRules(petRules(DenyBehavior.HIDDEN))
         .withChild(instance.getTable(LEDGER)));

      instance.addApp(new QAppMetaData()
         .withName(PET_DISABLED_APP)
         .withLabel("Pet Disabled App")
         .withIcon(new QIcon("lock_clock"))
         .withSortOrder(902)
         .withPermissionRules(petRules(DenyBehavior.DISABLED))
         .withChild(instance.getTable(LEDGER)));

      for(String name : List.of(LEDGER, VAULT, NOTE, ARCHIVE, AUDIT_LOG))
      {
         QInstanceEnricher.setInferredFieldBackendNames(instance.getTable(name));
      }
   }



   /*******************************************************************************
    ** Create and seed fixture tables; runs at startup and on every /acceptance/reset,
    ** after the stock prime-test-database.sql.
    *******************************************************************************/
   static void prime(Connection connection) throws Exception
   {
      for(String sql : List.of(
         "DROP TABLE IF EXISTS security_ledger",
         "CREATE TABLE security_ledger (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP DEFAULT NOW(), modify_date TIMESTAMP DEFAULT NOW(), entry_name VARCHAR(100), amount DECIMAL(12,2))",
         "INSERT INTO security_ledger (entry_name, amount) VALUES ('Opening Balance', 100.00), ('Quarterly Fee', -25.50)",

         "DROP TABLE IF EXISTS security_vault",
         "CREATE TABLE security_vault (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP DEFAULT NOW(), modify_date TIMESTAMP DEFAULT NOW(), label VARCHAR(100), vault_note VARCHAR(100), access_code VARCHAR(100), reveal_code VARCHAR(100), payload BLOB)",
         "INSERT INTO security_vault (label, vault_note, access_code, reveal_code, payload) VALUES ('Primary Vault', 'hidden-note-7f3a', 'vault-secret-1234', 'reveal-5678', X'68656176792D7061796C6F61642D39633265')",

         "DROP TABLE IF EXISTS security_note",
         "CREATE TABLE security_note (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP DEFAULT NOW(), modify_date TIMESTAMP DEFAULT NOW(), title VARCHAR(100), body VARCHAR(250), owner_id VARCHAR(250))",
         "INSERT INTO security_note (title, body, owner_id) VALUES ('Alice Plan', 'Alice private plan', 'sample:alice'), ('Alice Budget', 'Alice private budget', 'sample:alice'), ('Bob Memo', 'Bob private memo', 'sample:bob')",

         "DROP TABLE IF EXISTS security_archive",
         "CREATE TABLE security_archive (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP DEFAULT NOW(), modify_date TIMESTAMP DEFAULT NOW(), title VARCHAR(100))",
         "INSERT INTO security_archive (title) VALUES ('Archived Contract')",

         "DROP TABLE IF EXISTS security_audit_log",
         "CREATE TABLE security_audit_log (id INTEGER AUTO_INCREMENT PRIMARY KEY, create_date TIMESTAMP DEFAULT NOW(), modify_date TIMESTAMP DEFAULT NOW(), message VARCHAR(250))"))
      {
         QueryManager.executeUpdate(connection, sql);
      }
   }



   /*******************************************************************************
    ** An RDBMS table in the sample database with the standard id/create/modify fields.
    *******************************************************************************/
   private static QTableMetaData table(String name, String label, String tableName)
   {
      QTableMetaData table = new QTableMetaData()
         .withName(name)
         .withLabel(label)
         .withBackendName(BACKEND)
         .withBackendDetails(new RDBMSTableBackendDetails().withTableName(tableName))
         .withPrimaryKeyField("id")
         .withField(new QFieldMetaData("id", QFieldType.INTEGER).withLabel("Id").withIsEditable(false))
         .withField(new QFieldMetaData("createDate", QFieldType.DATE_TIME).withLabel("Create Date").withIsEditable(false))
         .withField(new QFieldMetaData("modifyDate", QFieldType.DATE_TIME).withLabel("Modify Date").withIsEditable(false));
      return (table);
   }



   /*******************************************************************************
    ** Permission rules keyed to the "pet" permission names (denied to noPets).
    *******************************************************************************/
   private static QPermissionRules petRules(DenyBehavior denyBehavior)
   {
      return (new QPermissionRules()
         .withLevel(PermissionLevel.READ_INSERT_EDIT_DELETE_PERMISSIONS)
         .withPermissionBaseName("pet")
         .withDenyBehavior(denyBehavior));
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static QNoCodeWidgetMetaData htmlWidget(String name, String label, String content, QPermissionRules rules)
   {
      QNoCodeWidgetMetaData widget = (QNoCodeWidgetMetaData) new QNoCodeWidgetMetaData()
         .withName(name)
         .withLabel(label)
         .withType(WidgetType.HTML.getType())
         .withGridColumns(4)
         .withIsCard(true)
         .withCodeReference(new QCodeReference(NoCodeWidgetRenderer.class));
      if(rules != null)
      {
         widget.withPermissionRules(rules);
      }
      widget.withOutput(new WidgetHtmlLine().withVelocityTemplate("<b>" + content + "</b>"));
      return (widget);
   }



   /*******************************************************************************
    ** Records that the audit ran, so a denied run can be proven to write nothing.
    *******************************************************************************/
   public static class RecordAuditStep implements BackendStep
   {
      /*******************************************************************************
       **
       *******************************************************************************/
      @Override
      public void run(RunBackendStepInput input, RunBackendStepOutput output) throws QException
      {
         String message = "Audit by " + QContext.getQSession().getUser().getIdReference();
         new InsertAction().execute(new InsertInput(AUDIT_LOG).withRecord(new QRecord().withValue("message", message)));
         output.addValue("auditMessage", message);
      }
   }
}
