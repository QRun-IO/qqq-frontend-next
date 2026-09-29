/*
 * Copyright 2026 QRun.IO, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at https://www.apache.org/licenses/LICENSE-2.0
 */

import java.util.List;
import com.kingsrook.qqq.api.model.APIVersion;
import com.kingsrook.qqq.api.model.metadata.ApiInstanceMetaData;
import com.kingsrook.qqq.api.model.metadata.ApiInstanceMetaDataContainer;
import com.kingsrook.qqq.api.model.metadata.ApiInstanceMetaDataProvider;
import com.kingsrook.qqq.api.model.metadata.tables.ApiTableMetaData;
import com.kingsrook.qqq.api.model.metadata.tables.ApiTableMetaDataContainer;
import com.kingsrook.qqq.backend.core.model.metadata.QInstance;


/** A real application API version for the report setup acceptance case. */
public class ApiVersionFixtures
{
   public static final String NAME = "acceptanceApi";
   public static final String PATH = "acceptance-api";
   public static final String VERSION = "2026.Q3";



   public static void define(QInstance instance)
   {
      APIVersion version = new APIVersion(VERSION);
      instance.withSupplementalMetaData(new ApiInstanceMetaDataContainer().withApiInstanceMetaData(new ApiInstanceMetaData()
         .withName(NAME).withPath("/" + PATH + "/").withLabel("Acceptance API")
         .withDescription("Owned report setup acceptance API").withContactEmail("reports@example.test")
         .withCurrentVersion(version).withSupportedVersions(List.of(version))));
      for(String tableName : List.of("person", "pet", "petNote", "petSpecies", "carrier", "qryStock"))
      {
         instance.getTable(tableName).withSupplementalMetaData(new ApiTableMetaDataContainer()
            .withApiTableMetaData(NAME, new ApiTableMetaData().withInitialVersion(VERSION)));
      }
      ApiInstanceMetaDataProvider.definePossibleValueSourcesForApiNameAndVersion(instance);
   }
}
