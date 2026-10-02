/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import io.javalin.config.JavalinConfig;
import org.eclipse.jetty.http.HttpFields;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.EventsHandler;
import org.json.JSONObject;


/*******************************************************************************
 ** Opt-in, metadata-only transport evidence for browser availability. This fixture
 ** observes Jetty write callbacks and final completion, after Javalin's request
 ** logger (which runs before output/compression closure). It never consumes a
 ** request/response buffer, changes headers, or logs cookie/body/query values.
 *******************************************************************************/
public final class AcceptanceTransportTrace extends EventsHandler
{
   private final AtomicLong sequence = new AtomicLong();
   private final Map<Request, Observation> requests = new ConcurrentHashMap<>();


   /***************************************************************************
    ** Javalin 7.2.3 applies this customizer before attaching its servlet context
    ** beneath the wrapper. Disabled runs retain the original handler tree.
    ***************************************************************************/
   public static void configure(JavalinConfig config)
   {
      if("1".equals(System.getenv("QQQ_ACCEPTANCE_TRANSPORT_TRACE")))
      {
         config.jetty.modifyServer(server ->
         {
            AcceptanceTransportTrace observer = new AcceptanceTransportTrace();
            observer.setHandler(server.getHandler());
            server.setHandler(observer);
         });
      }
   }


   @Override
   protected void onBeforeHandling(Request request)
   {
      String path = request.getHttpURI().getPath();
      if(path.equals("/") || path.startsWith("/app/") || path.startsWith("/_next/static/") || path.startsWith("/qqq/v1/"))
      {
         requests.put(request, new Observation(sequence.incrementAndGet()));
         emit(request, "start", 0, false, null);
      }
   }


   @Override
   protected void onResponseBegin(Request request, int status, HttpFields headers)
   {
      Observation observation = requests.get(request);
      if(observation != null) observation.status = status;
      emit(request, "response-begin", 0, false, null);
   }


   @Override
   protected void onResponseWriteComplete(Request request, boolean last, ByteBuffer content, Throwable failure)
   {
      // Jetty supplies a read-only duplicate retaining the original write bounds.
      // A failed write may have sent only part; its bytes are attempted, not delivered.
      int bytes = content == null ? 0 : content.remaining();
      Observation observation = requests.get(request);
      if(observation != null && failure == null) observation.successfulWriteBytes.addAndGet(bytes);
      if(observation != null && failure != null) observation.firstWriteFailure.compareAndSet(null, failure.getClass().getName());
      emit(request, "write-complete", bytes, last, failure);
   }


   @Override
   protected void onAfterHandling(Request request, boolean handled, Throwable failure)
   {
      emit(request, "handler-return", 0, false, failure);
   }


   @Override
   protected void onComplete(Request request, int status, HttpFields headers, Throwable failure)
   {
      Observation observation = requests.get(request);
      if(observation != null) observation.status = status;
      emit(request, "complete", 0, true, failure);
      requests.remove(request);
   }


   // Override payload-bearing default debug callbacks: even DEBUG must not dump
   // request content, response buffers, headers, or trailers from this observer.
   @Override
   protected void onRequestRead(Request request, Content.Chunk chunk) { }

   @Override
   protected void onResponseWrite(Request request, boolean last, ByteBuffer content) { }

   @Override
   protected void onResponseTrailersComplete(Request request, HttpFields trailers) { }


   private void emit(Request request, String event, int writeBytes, boolean last, Throwable failure)
   {
      Observation observation = requests.get(request);
      if(observation == null) return;
      System.out.println("QQQ_TRANSPORT " + new JSONObject()
         .put("time", Instant.now().toString())
         .put("nanoTime", System.nanoTime())
         .put("pid", ProcessHandle.current().pid())
         .put("requestId", observation.id)
         .put("connectionId", request.getConnectionMetaData().getId())
         .put("method", request.getMethod())
         .put("path", request.getHttpURI().getPath())
         .put("event", event)
         .put("status", observation.status == 0 ? JSONObject.NULL : observation.status)
         .put("writeBytes", writeBytes)
         // Completed server writes do not prove client receipt, decode or paint.
         .put("successfulWriteBytes", observation.successfulWriteBytes.get())
         .put("last", last)
         // Javalin can handle a failed write, leaving final completion's failure null.
         .put("firstWriteFailure", observation.firstWriteFailure.get() == null ? JSONObject.NULL : observation.firstWriteFailure.get())
         .put("failure", failure == null ? JSONObject.NULL : failure.getClass().getName()));
   }


   private static final class Observation
   {
      private final long id;
      private final AtomicLong successfulWriteBytes = new AtomicLong();
      private volatile int status;
      private final AtomicReference<String> firstWriteFailure = new AtomicReference<>();

      private Observation(long id)
      {
         this.id = id;
      }
   }
}
