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
import java.util.LinkedHashMap;
import java.util.List;
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
import com.kingsrook.qqq.backend.core.model.metadata.QAuthenticationType;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;
import com.kingsrook.qqq.backend.core.model.metadata.authentication.Auth0AuthenticationMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.authentication.AuthScope;
import com.kingsrook.qqq.backend.core.model.metadata.authentication.QAuthenticationMetaData;
import com.kingsrook.qqq.backend.core.model.metadata.code.QCodeReference;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.PermissionLevel;
import com.kingsrook.qqq.backend.core.model.metadata.permissions.QPermissionRules;
import com.kingsrook.qqq.backend.core.model.session.QSession;
import com.kingsrook.qqq.backend.core.modules.authentication.QAuthenticationModuleCustomizerInterface;
import com.kingsrook.qqq.backend.core.modules.authentication.implementations.TableBasedAuthenticationModule;
import com.kingsrook.qqq.backend.core.state.SimpleStateKey;
import com.kingsrook.qqq.backend.module.rdbms.jdbc.ConnectionManager;
import com.kingsrook.sampleapp.SampleJavalinServer;
import com.kingsrook.sampleapp.metadata.SampleMetaDataProvider;
import com.kingsrook.sampleapp.metadata.SampleSharingMetaDataProvider;
import org.json.JSONArray;
import org.json.JSONObject;


/*******************************************************************************
 ** Security-area backend variant of the acceptance fixture, started by the
 ** security specs on their own port (never the shared acceptance backend).
 **
 ** `-Dqqq.security.auth` selects the authentication module:
 **  - MOCK (default): the stock sample plus SecurityFixtures, with the same
 **    persona model as AcceptanceSampleServer (sessionId cookie keyed);
 **  - OAUTH2: the sample's own OAuth2 provider (OAUTH2_* environment), pointed
 **    by the specs at an owned local OIDC provider;
 **  - AUTH_0: Auth0 metadata from -Dqqq.security.auth0.* pointed at the same
 **    local provider;
 **  - FULLY_ANONYMOUS: anonymous sessions, no identity provider;
 **  - TABLE_BASED: username and password checked against the module's user
 **    table, sessions stored in its session table (SecurityFixtures);
 **  - UNSUPPORTED: anonymous sessions, but the v1 authentication metadata names
 **    a type no UI knows (a newer backend), which the UI must report.
 ** Loopback-only control routes: ready, reset, persona, single-SELECT sql, and
 ** expire-table-sessions (TABLE_BASED: every session idle past the timeout).
 *******************************************************************************/
public class SecurityAcceptanceServer
{
   private static final Map<String, String> PERSONAS = new ConcurrentHashMap<>();
   private static final Map<String, String> USERS    = new ConcurrentHashMap<>();
   private static final String              AUTH     = System.getProperty("qqq.security.auth", "MOCK");
   private static final String              UNSUPPORTED_TYPE = "ACCEPTANCE_UNKNOWN";
   private static volatile QInstance        instance;
   private static volatile boolean          primed;



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
            switch(AUTH)
            {
               case "MOCK" ->
               {
                  defined.setDefaultPermissionRules(QPermissionRules.defaultInstance().withLevel(PermissionLevel.READ_INSERT_EDIT_DELETE_PERMISSIONS));
                  defined.getAuthentication().setCustomizer(new QCodeReference(PersonaCustomizer.class));
                  SecurityFixtures.define(defined);
               }
               case "FULLY_ANONYMOUS", "UNSUPPORTED" -> defined.registerAuthenticationProvider(AuthScope.instanceDefault(),
                  new QAuthenticationMetaData().withName("anonymous").withType(QAuthenticationType.FULLY_ANONYMOUS));
               case "TABLE_BASED" -> defined.registerAuthenticationProvider(AuthScope.instanceDefault(), SecurityFixtures.defineTableBased(defined));
               case "AUTH_0" -> defined.registerAuthenticationProvider(AuthScope.instanceDefault(), new Auth0AuthenticationMetaData()
                  .withBaseUrl(System.getProperty("qqq.security.auth0.baseUrl"))
                  .withClientId(System.getProperty("qqq.security.auth0.clientId"))
                  .withClientSecret(System.getProperty("qqq.security.auth0.clientSecret"))
                  .withAudience(System.getProperty("qqq.security.auth0.audience"))
                  .withName("auth0"));
               case "OAUTH2" ->
               {
                  if(defined.getAuthentication() == null || defined.getAuthentication().getType() != QAuthenticationType.OAUTH2)
                  {
                     throw new QException("The OAUTH2 variant needs the sample's OAuth2 provider (run without qqq.sample.mockAuthentication).");
                  }
               }
               default -> throw new QException("Unknown qqq.security.auth: " + AUTH);
            }
            instance = defined;
            return defined;
         }
      });
      server.withJavalinConfigCustomizer(config ->
      {
         config.jetty.host = "127.0.0.1";
         ///////////////////////////////////////////////////////////////////////
         // ready only once the startup priming is done: a reset racing it    //
         // would drop and create the fixture tables concurrently             //
         ///////////////////////////////////////////////////////////////////////
         config.routes.get("/acceptance/ready", context ->
         {
            if(primed)
            {
               context.result("ready");
            }
            else
            {
               context.status(503).result("priming");
            }
         });
         if("UNSUPPORTED".equals(AUTH))
         {
            config.routes.before("/qqq/v1/metaData/authentication", context ->
            {
               context.contentType("application/json").result(new JSONObject().put("name", "futureAuth").put("type", UNSUPPORTED_TYPE).toString());
               context.skipRemainingHandlers();
            });
         }
         config.routes.post("/acceptance/expire-table-sessions", context ->
         {
            context.contentType("application/json").result(new JSONObject().put("expired", expireTableSessions()).toString());
         });
         config.routes.post("/acceptance/reset", context ->
         {
            reset();
            context.contentType("application/json").result("{}");
         });
         config.routes.post("/acceptance/persona", context ->
         {
            JSONObject body = new JSONObject(context.body());
            PERSONAS.put(body.getString("sessionId"), body.getString("persona"));
            USERS.put(body.getString("sessionId"), body.optString("user", "alice"));
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
      synchronized(SecurityAcceptanceServer.class)
      {
         primeFixtures();
      }
      primed = true;
   }



   /*******************************************************************************
    ** Restore the stock seed data and the security fixture data.
    *******************************************************************************/
   private static synchronized void reset() throws Exception
   {
      SampleMetaDataProvider.primeTestDatabase("prime-test-database.sql");
      if(Boolean.getBoolean("qqq.sample.sharing"))
      {
         SampleMetaDataProvider.primeTestDatabase("prime-sharing-database.sql");
      }
      primeFixtures();
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static void primeFixtures() throws Exception
   {
      if(!"MOCK".equals(AUTH) && !"TABLE_BASED".equals(AUTH))
      {
         return;
      }
      try(Connection connection = ownedConnection())
      {
         if("MOCK".equals(AUTH))
         {
            SecurityFixtures.prime(connection);
         }
         else
         {
            SecurityFixtures.primeTableBased(connection);
         }
      }
   }



   /*******************************************************************************
    ** TABLE_BASED: make every stored session idle for a day (past the module's
    ** inactivity timeout) and forget when each was last validated, so the next
    ** request with it goes through the module's real expiry check.
    *******************************************************************************/
   private static synchronized int expireTableSessions() throws Exception
   {
      if(!"TABLE_BASED".equals(AUTH))
      {
         throw new IllegalStateException("Only the TABLE_BASED variant stores table sessions.");
      }
      int expired = 0;
      try(Connection connection = ownedConnection(); PreparedStatement ids = connection.prepareStatement("SELECT id FROM table_auth_session"); ResultSet rows = ids.executeQuery())
      {
         while(rows.next())
         {
            TableBasedAuthenticationModule.getStateProvider().remove(new SimpleStateKey<>(rows.getString(1)));
            expired++;
         }
         try(PreparedStatement update = connection.prepareStatement("UPDATE table_auth_session SET access_timestamp = DATEADD('DAY', -1, CURRENT_TIMESTAMP)"))
         {
            update.executeUpdate();
         }
      }
      return (expired);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static Connection ownedConnection() throws Exception
   {
      Connection connection = ConnectionManager.getConnection(SampleMetaDataProvider.defineRdbmsBackend());
      if(!"jdbc:h2:mem:test_database".equals(connection.getMetaData().getURL()))
      {
         connection.close();
         throw new IllegalStateException("Security fixtures require the sample in-memory H2 database.");
      }
      return (connection);
   }



   /*******************************************************************************
    **
    *******************************************************************************/
   private static JSONArray select(String query) throws Exception
   {
      JSONArray records = new JSONArray();
      try(Connection connection = ownedConnection(); PreparedStatement statement = connection.prepareStatement(query); ResultSet rows = statement.executeQuery())
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
      return records;
   }



   /*******************************************************************************
    ** Same persona policy as AcceptanceSampleServer.permissionsFor.
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
         case "noApps" -> permission -> !"App".equals(permission.getObjectType());
         default -> permission -> true;
      };
      return all.stream().filter(keep).map(AvailablePermission::getName).collect(Collectors.toSet());
   }



   /*******************************************************************************
    ** Same session model as AcceptanceSampleServer.PersonaCustomizer.
    *******************************************************************************/
   public static class PersonaCustomizer implements QAuthenticationModuleCustomizerInterface
   {
      @Override
      public void customizeSession(QInstance qInstance, QSession session, Map<String, Object> context)
      {
         String persona = PERSONAS.getOrDefault(session.getUuid(), "admin");
         String user    = USERS.getOrDefault(session.getUuid(), "alice");
         if("expired".equals(persona))
         {
            SecurityAcceptanceServer.<RuntimeException>sneakyThrow(new QAuthenticationException("Session expired"));
         }
         String userId = "sample:" + user;
         session.getUser().setIdReference(userId);
         session.getUser().setFullName(Character.toUpperCase(user.charAt(0)) + user.substring(1) + " (sample)");
         session.withValueForFrontend("user", new LinkedHashMap<>(Map.of("name", session.getUser().getFullName(), "email", userId)));
         session.setSecurityKeyValues(Map.of(SampleSharingMetaDataProvider.USER_KEY, List.of(userId)));
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
