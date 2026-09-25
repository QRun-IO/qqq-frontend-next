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
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Collection;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import com.kingsrook.qqq.backend.core.actions.permissions.AvailablePermission;
import com.kingsrook.qqq.backend.core.actions.permissions.PermissionsHelper;
import com.kingsrook.qqq.backend.core.exceptions.QAuthenticationException;
import com.kingsrook.qqq.backend.core.exceptions.QException;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.session.QSession;
import com.kingsrook.qqq.backend.core.modules.authentication.QAuthenticationModuleCustomizerInterface;
import com.kingsrook.qqq.backend.module.rdbms.jdbc.ConnectionManager;
import com.kingsrook.sampleapp.SampleJavalinServer;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;
import org.json.JSONArray;
import org.json.JSONObject;


/*******************************************************************************
 ** Owned acceptance fixture: the stock sample application on loopback, with a
 ** granular permission policy, named personas keyed by the mock sessionId
 ** cookie, and loopback-only control routes for reset and SQL readback.
 *******************************************************************************/
public class AcceptanceSampleServer
{
   private static final Map<String, String> PERSONAS = new ConcurrentHashMap<>();
   private static volatile QInstance        instance;



   /*******************************************************************************
    **
    *******************************************************************************/
   public static void main(String[] args) throws Exception
   {
      SampleJavalinServer server = new SampleJavalinServer(new SampleMetaDataProvider()
      {
         @Override
         public QInstance defineQInstance() throws QException
         {
            QInstance defined = super.defineQInstance();
            defined.setDefaultPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_INSERT_EDIT_DELETE_PERMISSIONS));
            defined.getAuthentication().setCustomizer(new QCodeReference(PersonaCustomizer.class));
            NavigationFixtures.define(defined);
            RecordsFixtures.define(defined);
            QueryFixtures.define(defined);
            ProcessesFixtures.define(defined);
            WidgetsFixtures.define(defined);
            instance = defined;
            return defined;
         }
      });
      server.withJavalinConfigCustomizer(config ->
      {
         config.jetty.host = "127.0.0.1";
         config.routes.get("/acceptance/ready", context -> context.result("ready"));
         config.routes.post("/acceptance/reset", context ->
         {
            reset();
            context.contentType("application/json").result("{}");
         });
         config.routes.post("/acceptance/persona", context ->
         {
            JSONObject body = new JSONObject(context.body());
            PERSONAS.put(body.getString("sessionId"), body.getString("persona"));
            context.contentType("application/json").result("{}");
         });
         config.routes.post("/acceptance/sql", context ->
         {
            String query = new JSONObject(context.body()).getString("query").trim();
            if(!query.toLowerCase(Locale.ROOT).startsWith("select ") || query.contains(";"))
            {
               context.status(400).result("Only a single SELECT is allowed.");
               return;
            }
            context.contentType("application/json").result(new JSONObject().put("rows", select(query)).toString());
         });
      });
      Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
      server.start();
      primeFixtures();
   }



   /*******************************************************************************
    ** Restore the stock seed data and every area's fixture data.
    *******************************************************************************/
   private static synchronized void reset() throws Exception
   {
      SampleMetaDataProvider.primeTestDatabase("prime-test-database.sql");
      primeFixtures();
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void primeFixtures() throws Exception
   {
      try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend()))
      {
         if(!"jdbc:h2:mem:test_database".equals(connection.getMetaData().getURL()))
         {
            throw new IllegalStateException("Acceptance fixtures require the sample in-memory H2 database.");
         }
         NavigationFixtures.prime(connection);
         RecordsFixtures.prime(connection);
         QueryFixtures.prime(connection);
         ProcessesFixtures.prime(connection);
         WidgetsFixtures.prime(connection);
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static JSONArray select(String query) throws Exception
   {
      JSONArray records = new JSONArray();
      try(Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend()))
      {
         if(!"jdbc:h2:mem:test_database".equals(connection.getMetaData().getURL()))
         {
            throw new IllegalStateException("Acceptance readback requires the sample in-memory H2 database.");
         }
         try(PreparedStatement statement = connection.prepareStatement(query); ResultSet rows = statement.executeQuery())
         {
            while(rows.next())
            {
               JSONObject record = new JSONObject();
               for(int column = 1; column <= rows.getMetaData().getColumnCount(); column++)
               {
                  String value = rows.getMetaData().getColumnType(column) == java.sql.Types.BLOB
                     ? (rows.getBytes(column) == null ? null : java.util.Base64.getEncoder().encodeToString(rows.getBytes(column)))
                     : rows.getString(column);
                  record.put(rows.getMetaData().getColumnLabel(column).toLowerCase(Locale.ROOT), value == null ? JSONObject.NULL : value);
               }
               records.put(record);
            }
         }
      }
      return records;
   }



   /*******************************************************************************
    ** Permission sets per persona; unknown sessions (such as the initial
    ** manageSession call) receive the full administrator set.
    *******************************************************************************/
   static Set<String> permissionsFor(String persona)
   {
      Collection<AvailablePermission> all = PermissionsHelper.getAllAvailablePermissions(instance);
      Predicate<AvailablePermission> keep = switch(persona)
      {
         case "viewer" -> permission -> !"Process".equals(permission.getObjectType())
            && !permission.getName().matches(".*\\.(insert|edit|delete)$");
         case "noPets" -> permission -> !permission.getName().startsWith("pet.") && !permission.getName().startsWith("petNote.");
         case "noProcesses" -> permission -> !"Process".equals(permission.getObjectType());
         default -> permission -> true;
      };
      return all.stream().filter(keep).map(AvailablePermission::getName).collect(Collectors.toSet());
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   public static class PersonaCustomizer implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance qInstance, QSession session, Map<String, Object> context)
      {
         String persona = PERSONAS.getOrDefault(session.getUuid(), "admin");
         if("expired".equals(persona))
         {
            // Same path as a provider rejecting an expired token: 401 and the session cookie is cleared.
            AcceptanceSampleServer.<RuntimeException>sneakyThrow(new QAuthenticationException("Session expired"));
         }
         session.withPermissions(permissionsFor(persona));
      }
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   @SuppressWarnings("unchecked")
   private static <E extends Throwable> void sneakyThrow(Throwable throwable) throws E
   {
      throw (E) throwable;
   }
}
