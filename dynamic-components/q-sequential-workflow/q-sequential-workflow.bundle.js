(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("React"), require("ReactDOM"));
	else if(typeof define === 'function' && define.amd)
		define("QSequentialWorkflow", ["React", "ReactDOM"], factory);
	else if(typeof exports === 'object')
		exports["QSequentialWorkflow"] = factory(require("React"), require("ReactDOM"));
	else
		root["QSequentialWorkflow"] = factory(root["React"], root["ReactDOM"]);
})(globalThis, (__WEBPACK_EXTERNAL_MODULE_react__, __WEBPACK_EXTERNAL_MODULE_react_dom_client__) => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QPossibleValue.js"
/*!****************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/QPossibleValue.js ***!
  \****************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QPossibleValue: () => (/* binding */ QPossibleValue)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/*******************************************************************************
 ** id/label pair - for a possible-value dropdown
 **
 *******************************************************************************/
var QPossibleValue = /** @class */ (function () {
    function QPossibleValue(object) {
        this.id = object.id;
        this.label = object.label;
    }
    /***************************************************************************
     *
     ***************************************************************************/
    QPossibleValue.prototype.clone = function () {
        var clone = new QPossibleValue(__assign({}, this));
        return (clone);
    };
    return QPossibleValue;
}());

//# sourceMappingURL=QPossibleValue.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QRecord.js"
/*!*********************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/QRecord.js ***!
  \*********************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QRecord: () => (/* binding */ QRecord)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*******************************************************************************
 ** Data Record within qqq.  e.g., a single row from a database.
 **
 *******************************************************************************/
var QRecord = /** @class */ (function () {
    function QRecord(object) {
        var _a, _b;
        this.tableName = object.tableName;
        this.recordLabel = object.recordLabel;
        this.values = new Map();
        for (var key in object.values) {
            this.values.set(key, object.values[key]);
        }
        this.displayValues = new Map();
        for (var key in object.displayValues) {
            this.displayValues.set(key, object.displayValues[key]);
        }
        if (object.associatedRecords) {
            this.associatedRecords = new Map();
            for (var key in object.associatedRecords) {
                var list = [];
                this.associatedRecords.set(key, list);
                for (var i = 0; i < object.associatedRecords[key].length; i++) {
                    list.push(new QRecord(object.associatedRecords[key][i]));
                }
            }
        }
        if (object.errors) {
            this.errors = [];
            for (var i = 0; i < object.errors.length; i++) {
                this.errors.push((_a = object.errors[i].message) !== null && _a !== void 0 ? _a : object.errors[i]);
            }
        }
        if (object.warnings) {
            this.warnings = [];
            for (var i = 0; i < object.warnings.length; i++) {
                this.warnings.push((_b = object.warnings[i].message) !== null && _b !== void 0 ? _b : object.warnings[i]);
            }
        }
    }
    return QRecord;
}());

//# sourceMappingURL=QRecord.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/FieldAdornment.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/FieldAdornment.js ***!
  \*************************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FieldAdornment: () => (/* binding */ FieldAdornment)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*******************************************************************************
 ** Meta-data to represent an adornment for a field
 **
 *******************************************************************************/
var FieldAdornment = /** @class */ (function () {
    function FieldAdornment(object) {
        this.type = object.type;
        if (object.values) {
            this.values = new Map();
            for (var key in object.values) {
                this.values.set(key, object.values[key]);
            }
        }
    }
    FieldAdornment.prototype.getValue = function (key) {
        if (this.values) {
            return (this.values.get(key));
        }
        return (null);
    };
    /***************************************************************************
     *
     ***************************************************************************/
    FieldAdornment.prototype.clone = function () {
        var valuesClone = this.values ? new Map() : undefined;
        if (this.values && valuesClone) {
            this.values.forEach(function (value, key) {
                valuesClone.set(key, value);
            });
        }
        var clone = new FieldAdornment({ type: this.type });
        clone.values = valuesClone;
        return (clone);
    };
    return FieldAdornment;
}());

//# sourceMappingURL=FieldAdornment.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData.js ***!
  \*************************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QFieldMetaData: () => (/* binding */ QFieldMetaData)
/* harmony export */ });
/* harmony import */ var _QPossibleValue__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../QPossibleValue */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QPossibleValue.js");
/* harmony import */ var _query_QQueryFilter__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../query/QQueryFilter */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QQueryFilter.js");
/* harmony import */ var _FieldAdornment__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./FieldAdornment */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/FieldAdornment.js");
/* harmony import */ var _QHelpContent__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./QHelpContent */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QHelpContent.js");
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};




/*******************************************************************************
 ** Meta-data to represent a single field in a table.
 **
 *******************************************************************************/
var QFieldMetaData = /** @class */ (function () {
    /*******************************************************************************
     **
     *******************************************************************************/
    function QFieldMetaData(object) {
        var _a;
        this.isRequired = false;
        this.isEditable = true;
        this.isHeavy = false;
        this.isHidden = false;
        this.supplementalFieldMetaData = new Map();
        this.name = object.name;
        this.label = object.label;
        this.defaultValue = object.defaultValue;
        this.type = object.type;
        this.isRequired = object.isRequired;
        this.isEditable = object.isEditable;
        this.isHeavy = object.isHeavy;
        this.isHidden = object.isHidden;
        this.possibleValueSourceName = object.possibleValueSourceName;
        this.displayFormat = object.displayFormat;
        this.gridColumns = object.gridColumns;
        this.maxLength = object.maxLength;
        if (object.adornments) {
            this.adornments = [];
            for (var i = 0; i < object.adornments.length; i++) {
                this.adornments.push(new _FieldAdornment__WEBPACK_IMPORTED_MODULE_2__.FieldAdornment(object.adornments[i]));
            }
        }
        if (object.inlinePossibleValueSource) {
            this.inlinePossibleValueSource = [];
            for (var i = 0; i < ((_a = object.inlinePossibleValueSource.enumValues) === null || _a === void 0 ? void 0 : _a.length); i++) {
                this.inlinePossibleValueSource.push(new _QPossibleValue__WEBPACK_IMPORTED_MODULE_0__.QPossibleValue(object.inlinePossibleValueSource.enumValues[i]));
            }
        }
        this.helpContents = _QHelpContent__WEBPACK_IMPORTED_MODULE_3__.QHelpContent.buildArray(object.helpContents);
        this.behaviors = object.behaviors;
        if (object.supplementalFieldMetaData) {
            for (var key in object.supplementalFieldMetaData) {
                this.supplementalFieldMetaData.set(key, object.supplementalFieldMetaData[key]);
            }
        }
        if (object.possibleValueSourceFilter) {
            this.possibleValueSourceFilter = _query_QQueryFilter__WEBPACK_IMPORTED_MODULE_1__.QQueryFilter.makeFromObject(object.possibleValueSourceFilter);
        }
    }
    /*******************************************************************************
     ** test if this field has an adornment of a given type
     *******************************************************************************/
    QFieldMetaData.prototype.hasAdornment = function (type) {
        var adornment = this.getAdornment(type);
        return (adornment !== null);
    };
    /*******************************************************************************
     ** get the adornment of a given type from this field
     *******************************************************************************/
    QFieldMetaData.prototype.getAdornment = function (type) {
        if (this.adornments) {
            for (var i = 0; i < this.adornments.length; i++) {
                if (type === this.adornments[i].type) {
                    return (this.adornments[i]);
                }
            }
        }
        return (null);
    };
    /***************************************************************************
     *
     ***************************************************************************/
    QFieldMetaData.prototype.clone = function () {
        var inlinePossibleValueSourceClone = this.inlinePossibleValueSource ? [] : undefined;
        if (this.inlinePossibleValueSource && inlinePossibleValueSourceClone) {
            for (var _i = 0, _a = this.inlinePossibleValueSource; _i < _a.length; _i++) {
                var qPossibleValue = _a[_i];
                inlinePossibleValueSourceClone.push(qPossibleValue.clone());
            }
        }
        var adornmentsClone = this.adornments ? [] : undefined;
        if (this.adornments && adornmentsClone) {
            for (var _b = 0, _c = this.adornments; _b < _c.length; _b++) {
                var adornment = _c[_b];
                adornmentsClone.push(adornment.clone());
            }
        }
        var helpContentsClone = this.helpContents ? [] : undefined;
        if (this.helpContents && helpContentsClone) {
            for (var _d = 0, _e = this.helpContents; _d < _e.length; _d++) {
                var helpContent = _e[_d];
                helpContentsClone.push(helpContent.clone());
            }
        }
        var behaviorsClone = this.behaviors ? __spreadArray([], this.behaviors, true) : undefined;
        var supplementalFieldMetaDataClone = new Map();
        this.supplementalFieldMetaData.forEach(function (value, key) {
            supplementalFieldMetaDataClone.set(key, value);
        });
        var possibleValueSourceFilterClone = this.possibleValueSourceFilter ? this.possibleValueSourceFilter.clone() : undefined;
        var clone = new QFieldMetaData(__assign(__assign({}, this), { inlinePossibleValueSource: inlinePossibleValueSourceClone, behaviors: behaviorsClone, possibleValueSourceFilter: possibleValueSourceFilterClone }));
        if (adornmentsClone) {
            clone.adornments = adornmentsClone;
        }
        clone.helpContents = helpContentsClone;
        clone.supplementalFieldMetaData = supplementalFieldMetaDataClone;
        return (clone);
    };
    return QFieldMetaData;
}());

//# sourceMappingURL=QFieldMetaData.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QHelpContent.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QHelpContent.js ***!
  \***********************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QHelpContent: () => (/* binding */ QHelpContent)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/*******************************************************************************
 ** Meta-Data to define HelpContent
 **
 *******************************************************************************/
var QHelpContent = /** @class */ (function () {
    /*******************************************************************************
     **
     *******************************************************************************/
    function QHelpContent(object) {
        this.roles = new Set();
        this.content = object.content;
        this.format = object.format;
        if (object.roles) {
            for (var i = 0; i < object.roles.length; i++) {
                this.roles.add(object.roles[i]);
            }
        }
    }
    /*******************************************************************************
     ** factory method, for building an array of QHelpContent objects from array of
     ** unstructured data (e.g., as it would come from the backend)
     *******************************************************************************/
    QHelpContent.buildArray = function (helpContents) {
        var rs;
        if (helpContents) {
            rs = [];
            for (var i = 0; i < helpContents.length; i++) {
                rs.push(new QHelpContent(helpContents[i]));
            }
        }
        return (rs);
    };
    /*******************************************************************************
     ** factory method, for building an map of QHelpContent objects from map of
     ** unstructured data (e.g., as it would come from the backend)
     *******************************************************************************/
    QHelpContent.buildMap = function (object) {
        var rs = undefined;
        if (object) {
            rs = new Map();
            for (var key in object) {
                var list = [];
                rs.set(key, list);
                //////////////////////////////////////////////////////////////////////////////////////////////////////
                // allow object from backend to either be an array or a scalar (for migration from scalar to array) //
                //////////////////////////////////////////////////////////////////////////////////////////////////////
                if (object[key].length) {
                    for (var i = 0; i < object[key].length; i++) {
                        list.push(new QHelpContent(object[key][i]));
                    }
                }
                else {
                    list.push(new QHelpContent(object[key]));
                }
            }
        }
        return (rs);
    };
    /***************************************************************************
     *
     ***************************************************************************/
    QHelpContent.prototype.clone = function () {
        var rolesClone = new Set();
        this.roles.forEach(function (role) {
            rolesClone.add(role);
        });
        var clone = new QHelpContent(__assign({}, this));
        ////////////////////////////////////////////////////////////////////////////////
        // sets don't quite work as expected for this kind of clone, so copy manually //
        ////////////////////////////////////////////////////////////////////////////////
        clone.roles = rolesClone;
        return (clone);
    };
    return QHelpContent;
}());

//# sourceMappingURL=QHelpContent.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QCriteriaOperator.js"
/*!*************************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QCriteriaOperator.js ***!
  \*************************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QCriteriaOperator: () => (/* binding */ QCriteriaOperator)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*******************************************************************************
 ** Possible criteria operators for Q-filters.
 **
 *******************************************************************************/
var QCriteriaOperator;
(function (QCriteriaOperator) {
    QCriteriaOperator["EQUALS"] = "EQUALS";
    QCriteriaOperator["NOT_EQUALS"] = "NOT_EQUALS";
    QCriteriaOperator["NOT_EQUALS_OR_IS_NULL"] = "NOT_EQUALS_OR_IS_NULL";
    QCriteriaOperator["IN"] = "IN";
    QCriteriaOperator["NOT_IN"] = "NOT_IN";
    QCriteriaOperator["STARTS_WITH"] = "STARTS_WITH";
    QCriteriaOperator["ENDS_WITH"] = "ENDS_WITH";
    QCriteriaOperator["CONTAINS"] = "CONTAINS";
    QCriteriaOperator["NOT_STARTS_WITH"] = "NOT_STARTS_WITH";
    QCriteriaOperator["NOT_ENDS_WITH"] = "NOT_ENDS_WITH";
    QCriteriaOperator["NOT_CONTAINS"] = "NOT_CONTAINS";
    QCriteriaOperator["LESS_THAN"] = "LESS_THAN";
    QCriteriaOperator["LESS_THAN_OR_EQUALS"] = "LESS_THAN_OR_EQUALS";
    QCriteriaOperator["GREATER_THAN"] = "GREATER_THAN";
    QCriteriaOperator["GREATER_THAN_OR_EQUALS"] = "GREATER_THAN_OR_EQUALS";
    QCriteriaOperator["IS_BLANK"] = "IS_BLANK";
    QCriteriaOperator["IS_NOT_BLANK"] = "IS_NOT_BLANK";
    QCriteriaOperator["BETWEEN"] = "BETWEEN";
    QCriteriaOperator["NOT_BETWEEN"] = "NOT_BETWEEN";
})(QCriteriaOperator || (QCriteriaOperator = {}));
//# sourceMappingURL=QCriteriaOperator.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterCriteria.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterCriteria.js ***!
  \***********************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QFilterCriteria: () => (/* binding */ QFilterCriteria)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/*******************************************************************************
 ** Define a filter criteria in a QQQ instance.
 **
 *******************************************************************************/
var QFilterCriteria = /** @class */ (function () {
    function QFilterCriteria(fieldName, operator, values) {
        this.fieldName = fieldName;
        this.operator = operator;
        this.values = values;
    }
    /***************************************************************************
     *
     ***************************************************************************/
    QFilterCriteria.prototype.clone = function () {
        var clone = new QFilterCriteria(this.fieldName, this.operator, __spreadArray([], this.values, true));
        clone.otherFieldName = this.otherFieldName;
        return (clone);
    };
    return QFilterCriteria;
}());

//# sourceMappingURL=QFilterCriteria.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterOrderBy.js"
/*!**********************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterOrderBy.js ***!
  \**********************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QFilterOrderBy: () => (/* binding */ QFilterOrderBy)
/* harmony export */ });
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
/*******************************************************************************
 ** Define a filter order by in a QQQ instance.
 **
 *******************************************************************************/
var QFilterOrderBy = /** @class */ (function () {
    function QFilterOrderBy(fieldName, isAscending) {
        this.fieldName = fieldName;
        this.isAscending = isAscending;
    }
    /***************************************************************************
     *
     ***************************************************************************/
    QFilterOrderBy.prototype.clone = function () {
        var clone = new QFilterOrderBy(this.fieldName, this.isAscending);
        return (clone);
    };
    return QFilterOrderBy;
}());

//# sourceMappingURL=QFilterOrderBy.js.map

/***/ },

/***/ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QQueryFilter.js"
/*!********************************************************************************!*\
  !*** ./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QQueryFilter.js ***!
  \********************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QQueryFilter: () => (/* binding */ QQueryFilter)
/* harmony export */ });
/* harmony import */ var _QFilterCriteria__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./QFilterCriteria */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterCriteria.js");
/* harmony import */ var _QFilterOrderBy__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./QFilterOrderBy */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterOrderBy.js");
/*
 * QQQ - Low-code Application Framework for Engineers.
 * Copyright (C) 2021-2022.  Kingsrook, LLC
 * 651 N Broad St Ste 205 # 6917 | Middletown DE 19709 | United States
 * contact@kingsrook.com
 * https://github.com/Kingsrook/
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */


/*******************************************************************************
 ** Define a filter in a QQQ instance.
 **
 *******************************************************************************/
var QQueryFilter = /** @class */ (function () {
    /***************************************************************************
     *
     ***************************************************************************/
    function QQueryFilter(criteria, orderBys, subFilters, booleanOperator, skip, limit) {
        if (booleanOperator === void 0) { booleanOperator = "AND"; }
        this.criteria = criteria;
        this.orderBys = orderBys;
        this.subFilters = subFilters;
        this.booleanOperator = booleanOperator;
        this.skip = skip;
        this.limit = limit;
    }
    /***************************************************************************
     * factory method to build a QQueryFilter from an object containing all of
     * its component parts.
     ***************************************************************************/
    QQueryFilter.makeFromObject = function (object) {
        var _a, _b, _c, _d;
        var criteria = [];
        var orderBys = [];
        var subFilters = [];
        var booleanOperator = (_a = object.booleanOperator) !== null && _a !== void 0 ? _a : "AND";
        var skip = object.skip;
        var limit = object.limit;
        for (var i = 0; i < ((_b = object.criteria) === null || _b === void 0 ? void 0 : _b.length); i++) {
            var subObject = object.criteria[i];
            criteria.push(new _QFilterCriteria__WEBPACK_IMPORTED_MODULE_0__.QFilterCriteria(subObject.fieldName, subObject.operator, subObject.values));
        }
        for (var i = 0; i < ((_c = object.orderBys) === null || _c === void 0 ? void 0 : _c.length); i++) {
            var subObject = object.orderBys[i];
            orderBys.push(new _QFilterOrderBy__WEBPACK_IMPORTED_MODULE_1__.QFilterOrderBy(subObject.fieldName, subObject.isAscending));
        }
        for (var i = 0; i < ((_d = object.subFilters) === null || _d === void 0 ? void 0 : _d.length); i++) {
            subFilters.push(QQueryFilter.makeFromObject(object.subFilters[i]));
        }
        return (new QQueryFilter(criteria, orderBys, subFilters, booleanOperator, skip, limit));
    };
    QQueryFilter.prototype.addOrderBy = function (orderBy) {
        if (!this.orderBys) {
            this.orderBys = [];
        }
        this.orderBys.push(orderBy);
    };
    QQueryFilter.prototype.addCriteria = function (criteria) {
        if (!this.criteria) {
            this.criteria = [];
        }
        this.criteria.push(criteria);
    };
    QQueryFilter.prototype.addSubFilter = function (subFilter) {
        if (!this.subFilters) {
            this.subFilters = [];
        }
        this.subFilters.push(subFilter);
    };
    /***************************************************************************
     *
     ***************************************************************************/
    QQueryFilter.prototype.clone = function () {
        var criteriaClone = this.criteria ? [] : undefined;
        if (this.criteria && criteriaClone) {
            for (var _i = 0, _a = this.criteria; _i < _a.length; _i++) {
                var criteria = _a[_i];
                criteriaClone.push(criteria.clone());
            }
        }
        var orderBysClone = this.orderBys ? [] : undefined;
        if (this.orderBys && orderBysClone) {
            for (var _b = 0, _c = this.orderBys; _b < _c.length; _b++) {
                var orderBy = _c[_b];
                orderBysClone.push(orderBy.clone());
            }
        }
        var subFiltersClone = this.subFilters ? [] : undefined;
        if (this.subFilters && subFiltersClone) {
            for (var _d = 0, _e = this.subFilters; _d < _e.length; _d++) {
                var subFilter = _e[_d];
                subFiltersClone.push(subFilter.clone());
            }
        }
        var clone = new QQueryFilter(criteriaClone, orderBysClone, subFiltersClone, this.booleanOperator, this.skip, this.limit);
        return (clone);
    };
    return QQueryFilter;
}());

//# sourceMappingURL=QQueryFilter.js.map

/***/ },

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/sequential-workflow-designer/css/designer-light.css"
/*!****************************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/sequential-workflow-designer/css/designer-light.css ***!
  \****************************************************************************************************************/
(module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/* internal */
.sqd-theme-light .sqd-toolbox {
  background: #fff;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15);
  border: none;
  border-radius: 10px;
}
.sqd-theme-light .sqd-toolbox-header-title {
  color: #000;
}
.sqd-theme-light .sqd-toolbox-filter-input {
  background: #fff;
  color: #000;
  border: 1px solid #c3c3c3;
  border-radius: 10px;
}
.sqd-theme-light .sqd-toolbox-filter-input:focus {
  border-color: #939393;
}
.sqd-theme-light .sqd-toolbox-group-title {
  color: #000;
  background: #e5e5e5;
  border-radius: 10px;
}

.sqd-theme-light .sqd-toolbox-item {
  color: #000;
  border: 1px solid #c3c3c3;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.15);
  background: #fff;
  border-radius: 5px;
}
.sqd-theme-light .sqd-toolbox-item:hover {
  border-color: #939393;
  background: #fff;
}
.sqd-theme-light .sqd-toolbox-item .sqd-toolbox-item-icon.sqd-no-icon {
  background: #c6c6c6;
  border-radius: 4px;
}

.sqd-theme-light .sqd-control-bar {
  background: #fff;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15);
  border: none;
  border-radius: 10px;
}
.sqd-theme-light .sqd-control-bar-button {
  border: 1px solid #c3c3c3;
  background: #fff;
  border-radius: 5px;
}
.sqd-theme-light .sqd-control-bar-button:hover {
  border-color: #939393;
  background: #fff;
}
.sqd-theme-light .sqd-control-bar-button .sqd-icon-path {
  fill: #000;
}
.sqd-theme-light .sqd-control-bar-button.sqd-delete .sqd-icon-path {
  fill: #e01a24;
}

.sqd-theme-light .sqd-smart-editor {
  background: #fff;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
}
.sqd-theme-light .sqd-smart-editor-toggle {
  background: #fff;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
}

.sqd-theme-light.sqd-context-menu {
  background: #fff;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);
  border: none;
  border-radius: 4px;
}

.sqd-theme-light .sqd-context-menu-group {
  color: #888;
}

.sqd-theme-light .sqd-context-menu-item {
  color: #000;
  border-radius: 4px;
}

.sqd-theme-light .sqd-context-menu-item:hover {
  background: #eee;
}

.sqd-theme-light.sqd-designer {
  background: #f9f9f9;
}

.sqd-theme-light .sqd-line-grid-path {
  stroke: #e3e3e3;
  stroke-width: 1;
}

.sqd-theme-light .sqd-join {
  stroke-width: 2;
  stroke: #000;
}

.sqd-theme-light .sqd-region {
  stroke: #cecece;
  stroke-width: 2;
  stroke-dasharray: 3;
}
.sqd-theme-light .sqd-region.sqd-selected {
  stroke: #ed4800;
  stroke-width: 2;
  stroke-dasharray: 0;
}

.sqd-theme-light .sqd-placeholder .sqd-placeholder-rect {
  fill: #d8d8d8;
  stroke: #6a6a6a;
  stroke-width: 1;
  stroke-dasharray: 3;
}
.sqd-theme-light .sqd-placeholder.sqd-hover .sqd-placeholder-rect {
  fill: #ed4800;
}
.sqd-theme-light .sqd-placeholder-icon-path {
  fill: #2b2b2b;
}
.sqd-theme-light .sqd-placeholder.sqd-hover .sqd-placeholder-icon-path {
  fill: #fff;
}

.sqd-theme-light .sqd-validation-error {
  fill: #ffa200;
}
.sqd-theme-light .sqd-validation-error-icon-path {
  fill: #000;
}

.sqd-theme-light .sqd-root-start-stop-circle {
  fill: #2c18df;
}
.sqd-theme-light .sqd-root-start-stop-icon {
  fill: #fff;
}

.sqd-theme-light .sqd-step-task .sqd-step-task-rect {
  fill: #fff;
  stroke-width: 1;
  stroke: #c3c3c3;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.15));
}
.sqd-theme-light .sqd-step-task .sqd-step-task-rect.sqd-selected {
  stroke: #ed4800;
  stroke-width: 2;
}
.sqd-theme-light .sqd-step-task .sqd-step-task-text {
  fill: #000;
}
.sqd-theme-light .sqd-step-task .sqd-step-task-empty-icon {
  fill: #c6c6c6;
}
.sqd-theme-light .sqd-step-task .sqd-input {
  fill: #fff;
  stroke-width: 2;
  stroke: #000;
}
.sqd-theme-light .sqd-step-task .sqd-output {
  fill: #000;
  stroke-width: 0;
}

.sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-text {
  fill: #fff;
}
.sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect {
  fill: #2411db;
  stroke-width: 0;
}
.sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect {
  fill: #000;
  stroke-width: 0;
}
.sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-text {
  fill: #fff;
}
.sqd-theme-light .sqd-step-switch > g > .sqd-input {
  fill: #fff;
  stroke-width: 2;
  stroke: #000;
}

.sqd-theme-light .sqd-step-launch-pad > g > .sqd-input {
  fill: #fff;
  stroke-width: 2;
  stroke: #000;
}
.sqd-theme-light .sqd-step-launch-pad > g > .sqd-output {
  fill: #000;
  stroke-width: 0;
}

.sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-text {
  fill: #fff;
}
.sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect {
  fill: #2411db;
  stroke-width: 0;
}
.sqd-theme-light .sqd-step-container > g > .sqd-input {
  fill: #fff;
  stroke-width: 2;
  stroke: #000;
}
`, "",{"version":3,"sources":["webpack://./node_modules/sequential-workflow-designer/css/designer-light.css"],"names":[],"mappings":"AAAA,aAAa;AACb;EACE,gBAAgB;EAChB,sEAAsE;EACtE,YAAY;EACZ,mBAAmB;AACrB;AACA;EACE,WAAW;AACb;AACA;EACE,gBAAgB;EAChB,WAAW;EACX,yBAAyB;EACzB,mBAAmB;AACrB;AACA;EACE,qBAAqB;AACvB;AACA;EACE,WAAW;EACX,mBAAmB;EACnB,mBAAmB;AACrB;;AAEA;EACE,WAAW;EACX,yBAAyB;EACzB,yCAAyC;EACzC,gBAAgB;EAChB,kBAAkB;AACpB;AACA;EACE,qBAAqB;EACrB,gBAAgB;AAClB;AACA;EACE,mBAAmB;EACnB,kBAAkB;AACpB;;AAEA;EACE,gBAAgB;EAChB,sEAAsE;EACtE,YAAY;EACZ,mBAAmB;AACrB;AACA;EACE,yBAAyB;EACzB,gBAAgB;EAChB,kBAAkB;AACpB;AACA;EACE,qBAAqB;EACrB,gBAAgB;AAClB;AACA;EACE,UAAU;AACZ;AACA;EACE,aAAa;AACf;;AAEA;EACE,gBAAgB;EAChB,uCAAuC;AACzC;AACA;EACE,gBAAgB;EAChB,uCAAuC;AACzC;;AAEA;EACE,gBAAgB;EAChB,sCAAsC;EACtC,YAAY;EACZ,kBAAkB;AACpB;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,WAAW;EACX,kBAAkB;AACpB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,mBAAmB;AACrB;;AAEA;EACE,eAAe;EACf,eAAe;AACjB;;AAEA;EACE,eAAe;EACf,YAAY;AACd;;AAEA;EACE,eAAe;EACf,eAAe;EACf,mBAAmB;AACrB;AACA;EACE,eAAe;EACf,eAAe;EACf,mBAAmB;AACrB;;AAEA;EACE,aAAa;EACb,eAAe;EACf,eAAe;EACf,mBAAmB;AACrB;AACA;EACE,aAAa;AACf;AACA;EACE,aAAa;AACf;AACA;EACE,UAAU;AACZ;;AAEA;EACE,aAAa;AACf;AACA;EACE,UAAU;AACZ;;AAEA;EACE,aAAa;AACf;AACA;EACE,UAAU;AACZ;;AAEA;EACE,UAAU;EACV,eAAe;EACf,eAAe;EACf,kDAAkD;AACpD;AACA;EACE,eAAe;EACf,eAAe;AACjB;AACA;EACE,UAAU;AACZ;AACA;EACE,aAAa;AACf;AACA;EACE,UAAU;EACV,eAAe;EACf,YAAY;AACd;AACA;EACE,UAAU;EACV,eAAe;AACjB;;AAEA;EACE,UAAU;AACZ;AACA;EACE,aAAa;EACb,eAAe;AACjB;AACA;EACE,UAAU;EACV,eAAe;AACjB;AACA;EACE,UAAU;AACZ;AACA;EACE,UAAU;EACV,eAAe;EACf,YAAY;AACd;;AAEA;EACE,UAAU;EACV,eAAe;EACf,YAAY;AACd;AACA;EACE,UAAU;EACV,eAAe;AACjB;;AAEA;EACE,UAAU;AACZ;AACA;EACE,aAAa;EACb,eAAe;AACjB;AACA;EACE,UAAU;EACV,eAAe;EACf,YAAY;AACd","sourcesContent":["/* internal */\n.sqd-theme-light .sqd-toolbox {\n  background: #fff;\n  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15);\n  border: none;\n  border-radius: 10px;\n}\n.sqd-theme-light .sqd-toolbox-header-title {\n  color: #000;\n}\n.sqd-theme-light .sqd-toolbox-filter-input {\n  background: #fff;\n  color: #000;\n  border: 1px solid #c3c3c3;\n  border-radius: 10px;\n}\n.sqd-theme-light .sqd-toolbox-filter-input:focus {\n  border-color: #939393;\n}\n.sqd-theme-light .sqd-toolbox-group-title {\n  color: #000;\n  background: #e5e5e5;\n  border-radius: 10px;\n}\n\n.sqd-theme-light .sqd-toolbox-item {\n  color: #000;\n  border: 1px solid #c3c3c3;\n  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.15);\n  background: #fff;\n  border-radius: 5px;\n}\n.sqd-theme-light .sqd-toolbox-item:hover {\n  border-color: #939393;\n  background: #fff;\n}\n.sqd-theme-light .sqd-toolbox-item .sqd-toolbox-item-icon.sqd-no-icon {\n  background: #c6c6c6;\n  border-radius: 4px;\n}\n\n.sqd-theme-light .sqd-control-bar {\n  background: #fff;\n  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.15);\n  border: none;\n  border-radius: 10px;\n}\n.sqd-theme-light .sqd-control-bar-button {\n  border: 1px solid #c3c3c3;\n  background: #fff;\n  border-radius: 5px;\n}\n.sqd-theme-light .sqd-control-bar-button:hover {\n  border-color: #939393;\n  background: #fff;\n}\n.sqd-theme-light .sqd-control-bar-button .sqd-icon-path {\n  fill: #000;\n}\n.sqd-theme-light .sqd-control-bar-button.sqd-delete .sqd-icon-path {\n  fill: #e01a24;\n}\n\n.sqd-theme-light .sqd-smart-editor {\n  background: #fff;\n  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);\n}\n.sqd-theme-light .sqd-smart-editor-toggle {\n  background: #fff;\n  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);\n}\n\n.sqd-theme-light.sqd-context-menu {\n  background: #fff;\n  box-shadow: 0 0 8px rgba(0, 0, 0, 0.2);\n  border: none;\n  border-radius: 4px;\n}\n\n.sqd-theme-light .sqd-context-menu-group {\n  color: #888;\n}\n\n.sqd-theme-light .sqd-context-menu-item {\n  color: #000;\n  border-radius: 4px;\n}\n\n.sqd-theme-light .sqd-context-menu-item:hover {\n  background: #eee;\n}\n\n.sqd-theme-light.sqd-designer {\n  background: #f9f9f9;\n}\n\n.sqd-theme-light .sqd-line-grid-path {\n  stroke: #e3e3e3;\n  stroke-width: 1;\n}\n\n.sqd-theme-light .sqd-join {\n  stroke-width: 2;\n  stroke: #000;\n}\n\n.sqd-theme-light .sqd-region {\n  stroke: #cecece;\n  stroke-width: 2;\n  stroke-dasharray: 3;\n}\n.sqd-theme-light .sqd-region.sqd-selected {\n  stroke: #ed4800;\n  stroke-width: 2;\n  stroke-dasharray: 0;\n}\n\n.sqd-theme-light .sqd-placeholder .sqd-placeholder-rect {\n  fill: #d8d8d8;\n  stroke: #6a6a6a;\n  stroke-width: 1;\n  stroke-dasharray: 3;\n}\n.sqd-theme-light .sqd-placeholder.sqd-hover .sqd-placeholder-rect {\n  fill: #ed4800;\n}\n.sqd-theme-light .sqd-placeholder-icon-path {\n  fill: #2b2b2b;\n}\n.sqd-theme-light .sqd-placeholder.sqd-hover .sqd-placeholder-icon-path {\n  fill: #fff;\n}\n\n.sqd-theme-light .sqd-validation-error {\n  fill: #ffa200;\n}\n.sqd-theme-light .sqd-validation-error-icon-path {\n  fill: #000;\n}\n\n.sqd-theme-light .sqd-root-start-stop-circle {\n  fill: #2c18df;\n}\n.sqd-theme-light .sqd-root-start-stop-icon {\n  fill: #fff;\n}\n\n.sqd-theme-light .sqd-step-task .sqd-step-task-rect {\n  fill: #fff;\n  stroke-width: 1;\n  stroke: #c3c3c3;\n  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.15));\n}\n.sqd-theme-light .sqd-step-task .sqd-step-task-rect.sqd-selected {\n  stroke: #ed4800;\n  stroke-width: 2;\n}\n.sqd-theme-light .sqd-step-task .sqd-step-task-text {\n  fill: #000;\n}\n.sqd-theme-light .sqd-step-task .sqd-step-task-empty-icon {\n  fill: #c6c6c6;\n}\n.sqd-theme-light .sqd-step-task .sqd-input {\n  fill: #fff;\n  stroke-width: 2;\n  stroke: #000;\n}\n.sqd-theme-light .sqd-step-task .sqd-output {\n  fill: #000;\n  stroke-width: 0;\n}\n\n.sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-text {\n  fill: #fff;\n}\n.sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect {\n  fill: #2411db;\n  stroke-width: 0;\n}\n.sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect {\n  fill: #000;\n  stroke-width: 0;\n}\n.sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-text {\n  fill: #fff;\n}\n.sqd-theme-light .sqd-step-switch > g > .sqd-input {\n  fill: #fff;\n  stroke-width: 2;\n  stroke: #000;\n}\n\n.sqd-theme-light .sqd-step-launch-pad > g > .sqd-input {\n  fill: #fff;\n  stroke-width: 2;\n  stroke: #000;\n}\n.sqd-theme-light .sqd-step-launch-pad > g > .sqd-output {\n  fill: #000;\n  stroke-width: 0;\n}\n\n.sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-text {\n  fill: #fff;\n}\n.sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect {\n  fill: #2411db;\n  stroke-width: 0;\n}\n.sqd-theme-light .sqd-step-container > g > .sqd-input {\n  fill: #fff;\n  stroke-width: 2;\n  stroke: #000;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ "./node_modules/css-loader/dist/cjs.js!./node_modules/sequential-workflow-designer/css/designer.css"
/*!**********************************************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./node_modules/sequential-workflow-designer/css/designer.css ***!
  \**********************************************************************************************************/
(module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/* .sqd-designer */
.sqd-designer {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
}

.sqd-designer,
.sqd-drag,
.sqd-context-menu {
  font-size: 13px;
  line-height: 1em;
}

.sqd-hidden {
  display: none !important;
}

.sqd-disabled {
  opacity: 0.25;
}

/* .sqd-toolbox */
.sqd-toolbox,
.sqd-toolbox-filter-input {
  font-size: 11px;
  line-height: 1.2em;
}

.sqd-toolbox {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 20;
  box-sizing: border-box;
  width: 130px;
  -webkit-user-select: none;
  user-select: none;
}

.sqd-toolbox-header {
  position: relative;
  padding: 15px 10px;
  cursor: pointer;
}

.sqd-toolbox-header-title {
  display: block;
  font-size: 1.2em;
  line-height: 1em;
  font-weight: bold;
}

.sqd-toolbox-toggle-icon {
  position: absolute;
  top: 50%;
  right: 10px;
  width: 16px;
  height: 16px;
  margin: -8px 0 0;
}

.sqd-toolbox-header:hover .sqd-toolbox-toggle-icon {
  opacity: 0.6;
}

.sqd-scrollbox {
  position: relative;
  overflow: hidden;
}

.sqd-scrollbox-body {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 0 10px;
}

.sqd-toolbox-filter {
  padding: 0 10px 10px;
}

.sqd-toolbox-filter-input {
  display: block;
  box-sizing: border-box;
  padding: 6px 8px;
  outline: none;
  width: 100%;
}

.sqd-toolbox-group-title {
  text-align: center;
  padding: 5px 0;
  margin: 0 0 10px;
  width: 100%;
}

.sqd-toolbox-item {
  position: relative;
  box-sizing: border-box;
  margin: 0 0 10px;
  width: 100%;
  cursor: move;
}

.sqd-toolbox-item-icon {
  position: absolute;
  top: 50%;
  left: 5px;
  margin-top: -10px;
  width: 20px;
  height: 20px;
}

.sqd-toolbox-item-icon-image {
  width: 100%;
  height: 100%;
}

.sqd-toolbox-item-text {
  position: relative;
  display: block;
  padding: 10px 10px 10px 30px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.sqd-drag {
  position: absolute;
  z-index: 9999999;
  pointer-events: none;
}

/* .sqd-control-bar */
.sqd-control-bar {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 20;
  padding: 8px 0 8px 8px;
  white-space: nowrap;
  -webkit-user-select: none;
  user-select: none;
}

.sqd-control-bar-button {
  display: inline-block;
  width: 32px;
  height: 32px;
  margin-right: 8px;
  cursor: pointer;
  box-sizing: border-box;
}

.sqd-control-bar-button-icon {
  width: 24px;
  height: 24px;
  margin: 3px 0 0 3px;
}

.sqd-control-bar-button.sqd-disabled .sqd-control-bar-button-icon {
  opacity: 0.2;
}

/* .sqd-smart-editor */
.sqd-smart-editor-toggle {
  position: absolute;
  top: 0;
  z-index: 29;
  width: 36px;
  height: 64px;
  border-bottom-left-radius: 10px;
  cursor: pointer;
}

.sqd-smart-editor-toggle-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  margin: -12px 0 0 -12px;
}

.sqd-smart-editor-toggle:hover .sqd-smart-editor-toggle-icon {
  opacity: 0.6;
}

.sqd-smart-editor {
  z-index: 30;
}

.sqd-layout-desktop .sqd-smart-editor {
  position: relative;
  width: 300px;
}

.sqd-layout-desktop .sqd-smart-editor-toggle {
  right: 300px;
}

.sqd-layout-desktop .sqd-smart-editor-toggle.sqd-collapsed {
  right: 0;
}

.sqd-layout-mobile .sqd-smart-editor {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 41px;
}

.sqd-layout-mobile .sqd-smart-editor-toggle {
  left: 5px;
}

.sqd-layout-mobile .sqd-smart-editor-toggle.sqd-collapsed {
  left: auto;
  right: 0;
}

/* .sqd-context-menu */
.sqd-context-menu {
  position: absolute;
  z-index: 2000000000;
  overflow: hidden;
  padding: 5px;
}

.sqd-context-menu-group,
.sqd-context-menu-item {
  width: 130px;
  padding: 8px 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.sqd-context-menu-group {
  font-size: 11px;
  line-height: 1em;
}

.sqd-context-menu-item {
  cursor: pointer;
  transition: background 70ms;
}

/* .sqd-workspace */
.sqd-workspace {
  flex: 1;
  position: relative;
  display: block;
  -webkit-user-select: none;
  user-select: none;
}

.sqd-workspace-canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: move;
}

.sqd-label-text {
  text-anchor: middle;
  dominant-baseline: central;
}

.sqd-placeholder .sqd-placeholder-rect {
  transition: fill 100ms;
}

.sqd-step-task-text {
  text-anchor: left;
  dominant-baseline: central;
}
`, "",{"version":3,"sources":["webpack://./node_modules/sequential-workflow-designer/css/designer.css"],"names":[],"mappings":"AAAA,kBAAkB;AAClB;EACE,kBAAkB;EAClB,aAAa;EACb,WAAW;EACX,YAAY;AACd;;AAEA;;;EAGE,eAAe;EACf,gBAAgB;AAClB;;AAEA;EACE,wBAAwB;AAC1B;;AAEA;EACE,aAAa;AACf;;AAEA,iBAAiB;AACjB;;EAEE,eAAe;EACf,kBAAkB;AACpB;;AAEA;EACE,kBAAkB;EAClB,SAAS;EACT,UAAU;EACV,WAAW;EACX,sBAAsB;EACtB,YAAY;EACZ,yBAAyB;EACzB,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;EAClB,kBAAkB;EAClB,eAAe;AACjB;;AAEA;EACE,cAAc;EACd,gBAAgB;EAChB,gBAAgB;EAChB,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;EAClB,QAAQ;EACR,WAAW;EACX,WAAW;EACX,YAAY;EACZ,gBAAgB;AAClB;;AAEA;EACE,YAAY;AACd;;AAEA;EACE,kBAAkB;EAClB,gBAAgB;AAClB;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,OAAO;EACP,WAAW;EACX,sBAAsB;EACtB,eAAe;AACjB;;AAEA;EACE,oBAAoB;AACtB;;AAEA;EACE,cAAc;EACd,sBAAsB;EACtB,gBAAgB;EAChB,aAAa;EACb,WAAW;AACb;;AAEA;EACE,kBAAkB;EAClB,cAAc;EACd,gBAAgB;EAChB,WAAW;AACb;;AAEA;EACE,kBAAkB;EAClB,sBAAsB;EACtB,gBAAgB;EAChB,WAAW;EACX,YAAY;AACd;;AAEA;EACE,kBAAkB;EAClB,QAAQ;EACR,SAAS;EACT,iBAAiB;EACjB,WAAW;EACX,YAAY;AACd;;AAEA;EACE,WAAW;EACX,YAAY;AACd;;AAEA;EACE,kBAAkB;EAClB,cAAc;EACd,4BAA4B;EAC5B,mBAAmB;EACnB,uBAAuB;EACvB,gBAAgB;AAClB;;AAEA;EACE,kBAAkB;EAClB,gBAAgB;EAChB,oBAAoB;AACtB;;AAEA,qBAAqB;AACrB;EACE,kBAAkB;EAClB,YAAY;EACZ,UAAU;EACV,WAAW;EACX,sBAAsB;EACtB,mBAAmB;EACnB,yBAAyB;EACzB,iBAAiB;AACnB;;AAEA;EACE,qBAAqB;EACrB,WAAW;EACX,YAAY;EACZ,iBAAiB;EACjB,eAAe;EACf,sBAAsB;AACxB;;AAEA;EACE,WAAW;EACX,YAAY;EACZ,mBAAmB;AACrB;;AAEA;EACE,YAAY;AACd;;AAEA,sBAAsB;AACtB;EACE,kBAAkB;EAClB,MAAM;EACN,WAAW;EACX,WAAW;EACX,YAAY;EACZ,+BAA+B;EAC/B,eAAe;AACjB;;AAEA;EACE,kBAAkB;EAClB,QAAQ;EACR,SAAS;EACT,WAAW;EACX,YAAY;EACZ,uBAAuB;AACzB;;AAEA;EACE,YAAY;AACd;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,kBAAkB;EAClB,YAAY;AACd;;AAEA;EACE,YAAY;AACd;;AAEA;EACE,QAAQ;AACV;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,QAAQ;EACR,SAAS;EACT,UAAU;AACZ;;AAEA;EACE,SAAS;AACX;;AAEA;EACE,UAAU;EACV,QAAQ;AACV;;AAEA,sBAAsB;AACtB;EACE,kBAAkB;EAClB,mBAAmB;EACnB,gBAAgB;EAChB,YAAY;AACd;;AAEA;;EAEE,YAAY;EACZ,iBAAiB;EACjB,mBAAmB;EACnB,uBAAuB;EACvB,gBAAgB;AAClB;;AAEA;EACE,eAAe;EACf,gBAAgB;AAClB;;AAEA;EACE,eAAe;EACf,2BAA2B;AAC7B;;AAEA,mBAAmB;AACnB;EACE,OAAO;EACP,kBAAkB;EAClB,cAAc;EACd,yBAAyB;EACzB,iBAAiB;AACnB;;AAEA;EACE,kBAAkB;EAClB,MAAM;EACN,OAAO;EACP,YAAY;AACd;;AAEA;EACE,mBAAmB;EACnB,0BAA0B;AAC5B;;AAEA;EACE,sBAAsB;AACxB;;AAEA;EACE,iBAAiB;EACjB,0BAA0B;AAC5B","sourcesContent":["/* .sqd-designer */\n.sqd-designer {\n  position: relative;\n  display: flex;\n  width: 100%;\n  height: 100%;\n}\n\n.sqd-designer,\n.sqd-drag,\n.sqd-context-menu {\n  font-size: 13px;\n  line-height: 1em;\n}\n\n.sqd-hidden {\n  display: none !important;\n}\n\n.sqd-disabled {\n  opacity: 0.25;\n}\n\n/* .sqd-toolbox */\n.sqd-toolbox,\n.sqd-toolbox-filter-input {\n  font-size: 11px;\n  line-height: 1.2em;\n}\n\n.sqd-toolbox {\n  position: absolute;\n  top: 10px;\n  left: 10px;\n  z-index: 20;\n  box-sizing: border-box;\n  width: 130px;\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.sqd-toolbox-header {\n  position: relative;\n  padding: 15px 10px;\n  cursor: pointer;\n}\n\n.sqd-toolbox-header-title {\n  display: block;\n  font-size: 1.2em;\n  line-height: 1em;\n  font-weight: bold;\n}\n\n.sqd-toolbox-toggle-icon {\n  position: absolute;\n  top: 50%;\n  right: 10px;\n  width: 16px;\n  height: 16px;\n  margin: -8px 0 0;\n}\n\n.sqd-toolbox-header:hover .sqd-toolbox-toggle-icon {\n  opacity: 0.6;\n}\n\n.sqd-scrollbox {\n  position: relative;\n  overflow: hidden;\n}\n\n.sqd-scrollbox-body {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  box-sizing: border-box;\n  padding: 0 10px;\n}\n\n.sqd-toolbox-filter {\n  padding: 0 10px 10px;\n}\n\n.sqd-toolbox-filter-input {\n  display: block;\n  box-sizing: border-box;\n  padding: 6px 8px;\n  outline: none;\n  width: 100%;\n}\n\n.sqd-toolbox-group-title {\n  text-align: center;\n  padding: 5px 0;\n  margin: 0 0 10px;\n  width: 100%;\n}\n\n.sqd-toolbox-item {\n  position: relative;\n  box-sizing: border-box;\n  margin: 0 0 10px;\n  width: 100%;\n  cursor: move;\n}\n\n.sqd-toolbox-item-icon {\n  position: absolute;\n  top: 50%;\n  left: 5px;\n  margin-top: -10px;\n  width: 20px;\n  height: 20px;\n}\n\n.sqd-toolbox-item-icon-image {\n  width: 100%;\n  height: 100%;\n}\n\n.sqd-toolbox-item-text {\n  position: relative;\n  display: block;\n  padding: 10px 10px 10px 30px;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  overflow: hidden;\n}\n\n.sqd-drag {\n  position: absolute;\n  z-index: 9999999;\n  pointer-events: none;\n}\n\n/* .sqd-control-bar */\n.sqd-control-bar {\n  position: absolute;\n  bottom: 10px;\n  left: 10px;\n  z-index: 20;\n  padding: 8px 0 8px 8px;\n  white-space: nowrap;\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.sqd-control-bar-button {\n  display: inline-block;\n  width: 32px;\n  height: 32px;\n  margin-right: 8px;\n  cursor: pointer;\n  box-sizing: border-box;\n}\n\n.sqd-control-bar-button-icon {\n  width: 24px;\n  height: 24px;\n  margin: 3px 0 0 3px;\n}\n\n.sqd-control-bar-button.sqd-disabled .sqd-control-bar-button-icon {\n  opacity: 0.2;\n}\n\n/* .sqd-smart-editor */\n.sqd-smart-editor-toggle {\n  position: absolute;\n  top: 0;\n  z-index: 29;\n  width: 36px;\n  height: 64px;\n  border-bottom-left-radius: 10px;\n  cursor: pointer;\n}\n\n.sqd-smart-editor-toggle-icon {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  width: 24px;\n  height: 24px;\n  margin: -12px 0 0 -12px;\n}\n\n.sqd-smart-editor-toggle:hover .sqd-smart-editor-toggle-icon {\n  opacity: 0.6;\n}\n\n.sqd-smart-editor {\n  z-index: 30;\n}\n\n.sqd-layout-desktop .sqd-smart-editor {\n  position: relative;\n  width: 300px;\n}\n\n.sqd-layout-desktop .sqd-smart-editor-toggle {\n  right: 300px;\n}\n\n.sqd-layout-desktop .sqd-smart-editor-toggle.sqd-collapsed {\n  right: 0;\n}\n\n.sqd-layout-mobile .sqd-smart-editor {\n  position: absolute;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 41px;\n}\n\n.sqd-layout-mobile .sqd-smart-editor-toggle {\n  left: 5px;\n}\n\n.sqd-layout-mobile .sqd-smart-editor-toggle.sqd-collapsed {\n  left: auto;\n  right: 0;\n}\n\n/* .sqd-context-menu */\n.sqd-context-menu {\n  position: absolute;\n  z-index: 2000000000;\n  overflow: hidden;\n  padding: 5px;\n}\n\n.sqd-context-menu-group,\n.sqd-context-menu-item {\n  width: 130px;\n  padding: 8px 10px;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n  overflow: hidden;\n}\n\n.sqd-context-menu-group {\n  font-size: 11px;\n  line-height: 1em;\n}\n\n.sqd-context-menu-item {\n  cursor: pointer;\n  transition: background 70ms;\n}\n\n/* .sqd-workspace */\n.sqd-workspace {\n  flex: 1;\n  position: relative;\n  display: block;\n  -webkit-user-select: none;\n  user-select: none;\n}\n\n.sqd-workspace-canvas {\n  position: absolute;\n  top: 0;\n  left: 0;\n  cursor: move;\n}\n\n.sqd-label-text {\n  text-anchor: middle;\n  dominant-baseline: central;\n}\n\n.sqd-placeholder .sqd-placeholder-rect {\n  transition: fill 100ms;\n}\n\n.sqd-step-task-text {\n  text-anchor: left;\n  dominant-baseline: central;\n}\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ "./node_modules/css-loader/dist/cjs.js!./src/component/styles.css"
/*!************************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./src/component/styles.css ***!
  \************************************************************************/
(module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../node_modules/css-loader/dist/runtime/getUrl.js */ "./node_modules/css-loader/dist/runtime/getUrl.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2__);
// Imports



var ___CSS_LOADER_URL_IMPORT_0___ = new URL(/* asset import */ __webpack_require__(/*! data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTExIDE4YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTItOGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTYgNGMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyIDJ6bTAgMmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAgNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6Ii8+Cjwvc3ZnPgo= */ "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTExIDE4YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTItOGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTYgNGMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyIDJ6bTAgMmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAgNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6Ii8+Cjwvc3ZnPgo="), __webpack_require__.b);
var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
var ___CSS_LOADER_URL_REPLACEMENT_0___ = _node_modules_css_loader_dist_runtime_getUrl_js__WEBPACK_IMPORTED_MODULE_2___default()(___CSS_LOADER_URL_IMPORT_0___);
// Module
___CSS_LOADER_EXPORT___.push([module.id, `:root
{
   --qsqd-light-gray-bg: #e1e1e1;
   --qsqd-med-gray-bg: #bbbbbb;
   --qsqd-dark-gray-border: #888888;
   --qsqd-dark-text: #404040;
   --qsqd-med-text: #606060;
   --qsqd-light-text: #808080;
   --qsqd-padding: 0.5rem;
   --qsqd-radius: 0.25rem;
   --qsqd-accent: #0062FF;
   --qsqd-highlight: #0ac42c;
}

.sqd-designer-react
{
   width: 100%;
   height: 100%;
}

.sqd-designer,
.qSequentialWorkflow
{
   height: 100%;
}

.maximized .qSequentialWorkflow .sqd-designer
{
   border-radius: 1rem;
}

.maximized .qSequentialWorkflow .sqd-smart-editor
{
   border-radius: 0 1rem 1rem 0;
}

.qSequentialWorkflow .sqd-layout-desktop .sqd-smart-editor
{
   min-width: 300px;
   max-width: 600px;
   width: 20%;
}

.qSequentialWorkflow .sqd-layout-desktop .sqd-smart-editor-toggle
{
   height: 36px;
   z-index: 31;
   right: 0;
   border-top-right-radius: 1rem;
   box-shadow: none;
}

.qSequentialWorkflow .sqd-layout-desktop .sqd-smart-editor-toggle.sqd-collapsed
{
   box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
}

.qSequentialWorkflow *,
.sqd-drag *,
.sqd-context-menu *
{
   font-family: helvetica, sans-serif;
}

.qSequentialWorkflow .sqd-toolbox-item-text
{
   white-space: normal;
}

.qSequentialWorkflow .sqd-theme-light .sqd-toolbox
{
   top: 0;
   left: 0;
   border-radius: 1rem 0 0 0;
   width: 200px;
}

.qSequentialWorkflow .sqd-theme-light .sqd-toolbox .sqd-scrollbox
{
   height: calc(100vh - 245px) !important;
}

.toolbox-handle-icons .qSequentialWorkflow .sqd-toolbox-item .sqd-toolbox-item-icon
{
   content: url(${___CSS_LOADER_URL_REPLACEMENT_0___});
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect
{
   fill: var(--qsqd-med-gray-bg);
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect
{
   fill: var(--qsqd-light-gray-bg);
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-text
{
   fill: black;
}

.qSequentialWorkflow .sqd-root-start-stop-start circle
{
   fill: #007c00;
}

.toolbox-handle-icons .sqd-theme-light .sqd-toolbox-item .sqd-toolbox-item-icon.sqd-no-icon
{
   background: none;
}

.qSequentialWorkflow .sqd-root-start-stop-stop circle,
.qSequentialWorkflow .stop-icon-circle
{
   fill: #9a0000;
}

.qSequentialWorkflow .stop-icon-square
{
   fill: #FFFFFF;
}

.qSequentialWorkflow .sqd-theme-light .sqd-join
{
   stroke-width: 1;
}

.qSequentialWorkflow .sqd-editor
{
   padding: 1rem;
   overflow: auto;
   max-height: calc(100vh - 10rem);
}

.qSequentialWorkflow .sqd-editor h2
{
   /* room for the 'x' */
   margin-right: 20px;
}

.qSequentialWorkflow .sqd-editor .MuiGrid-root.MuiGrid-container
{
   margin-left: 0;
}

.qSequentialWorkflow .sqd-editor .MuiGrid-root.MuiGrid-item
{
   padding-left: 0;
}

.qSequentialWorkflow .sqd-smart-editor
{
   line-height: 1.3;
}

.qswdCustomDraggedComponent
{
   background: var(--qsqd-light-gray-bg);
   border: 1px solid var(--qsqd-dark-gray-border);
   border-radius: var(--qsqd-radius);
   padding: var(--qsqd-padding);
}


.qSequentialWorkflow.readonly .sqd-toolbox,
.qSequentialWorkflow.readonly .sqd-smart-editor,
.qSequentialWorkflow.readonly .sqd-smart-editor-toggle
{
   display: none;
}

.qSequentialWorkflow.readonly .sqd-control-bar-button.sqd-disabled[title="Undo"],
.qSequentialWorkflow.readonly .sqd-control-bar-button.sqd-disabled[title="Redo"]
{
   display: none;
}

.qswdDebugPanel
{
   background: #d6ffd6;
   border: 3px solid green;
   bottom: 20px;
   right: 20px;
   padding: 20px;
   border-radius: 20px;
   position: absolute;
   z-index: 9999;
   font-family: helvetica, sans-serif;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-rect.sqd-selected,
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-rect.sqd-selected,
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-label-rect.sqd-selected
{
   stroke: var(--qsqd-accent);
}

.qSequentialWorkflow .sqd-theme-light .sqd-region.sqd-selected
{
   stroke: var(--qsqd-accent);
}

.qSequentialWorkflow .sqd-theme-light .sqd-placeholder.sqd-hover .sqd-placeholder-rect
{
   fill: var(--qsqd-accent);
}

.qSequentialWorkflow .sqd-designer .sqd-label
{
   font-size: 16px;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-text
{
   text-anchor: start;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > g > .sqd-input
{
   stroke-width: 1;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-text,
.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-name-text,
.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-text,
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-text
{
   fill: var(--qsqd-dark-text);
   font-size: 16px;
}


.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect,
.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect,
.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect,
.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-rect,
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-rect
{
   fill: white;
   stroke: #888888;
   stroke-width: 1;
   filter: drop-shadow(0 1.5px 1.5px rgba(0, 0, 0, 0.15));
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-box,
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .icon-container,
.qSequentialWorkflow .sqd-theme-light .sqd-step-container .sqd-input,
.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > g > .sqd-input,
.qSequentialWorkflow .sqd-theme-light .step-icon-rect
{
   stroke: #9da3ae;
   stroke-width: 1;
   fill: white;
}


.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary .sqd-label-rect[data-qswdSelected="true"],
.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary .sqd-label-rect.sqd-selected,
.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect.sqd-selected
{
   stroke: var(--qsqd-accent);
   stroke-width: 2;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-rect[data-qswdTraced="true"],
.qSequentialWorkflow .sqd-theme-light .sqd-step-switch .sqd-label-primary rect[data-qswdTraced="true"],
.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect[data-qswdTraced="true"],
.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect[data-qswdTraced="true"],
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-rect[data-qswdTraced="true"]
{
   stroke: var(--qsqd-highlight);
   stroke-width: 2;
   fill: #DBFFE3FF;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect,
.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect
{
   fill: white;
}

.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect
{
   fill: #e0e0e0;
}

.qSequentialWorkflow .sqd-theme-light .switch-summary-text,
.qSequentialWorkflow .sqd-theme-light .large-task-summary-text
{
   fill: var(--qsqd-med-text);
   font-size: 14px;
}

.qSequentialWorkflow .sqd-theme-light .switch-description-text,
.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .large-task-description-text,
.qSequentialWorkflow .sqd-theme-light .sqd-step-task .interrupting-task-description-text
{
   fill: var(--qsqd-light-text);
}

.qswdStepEditorWidgetWrapper .bridgedWidget
{
   margin: -1rem;
   width: calc(100% + 2rem);
}

.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup
{
   margin-top: -3rem;
}

/* hide the redundant "Filter" label */
.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup h6
{
   visibility: hidden;
}

.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup h5
{
   font-size: 1rem;
}

.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup .widgetLabelBox button
{
   position: relative;
   white-space: nowrap;
   top: 2.25rem;
}

.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup .advancedQueryString > div > span
{
   margin-bottom: 0.375rem !important;
}

.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup .advancedQueryString
{
   overflow: auto;
}

/* filter widget within row builder */
.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .advancedQueryString
{
   overflow: auto;
   margin-top: -0.75rem;
}
.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .advancedQueryString div
{
   white-space: nowrap;
   line-height: 1.6;
}

.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .rowBuilderRowForm
{
   max-width: calc(100% - 75px);
}

.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .editFiltersButton p
{
   font-size: 1rem;
}

.qSequentialWorkflow .sqd-control-bar
{
   z-index: 31;
}

.qSequentialWorkflow .testForm
{
   width: 100%;
}

.qSequentialWorkflow .testForm .scenarioButtons
{
   display: flex;
   flex-direction: row-reverse;
   margin: 0.5rem 0;
}

.qSequentialWorkflow .testForm .resultsContainer
{
   border: 1px solid gray;
   border-radius: 0.5rem;
   overflow: hidden;
   height: calc(100vh - 420px);
   font-variant-numeric: tabular-nums;
}

.qSequentialWorkflow .testForm .resultsContainer > ul
{
   height: 100%;
   overflow: auto;
   padding: 0 !important;
}

.qSequentialWorkflow .testForm .resultsContainer > ul > li
{
   padding-bottom: 0.5rem;
}

.qSequentialWorkflow .testForm .resultsContainer ul
{
   padding-left: 1.25rem;
}

.qSequentialWorkflow .testForm .resultsContainer li
{
   list-style: none;
}

.qSequentialWorkflow .testForm .resultsContainer ul *
{
   white-space: nowrap;
}

.qSequentialWorkflow .testForm .resultsContainer ul .outputData
{
   white-space: pre;
   font-family: monospace;
}

.qSequentialWorkflow .testForm .resultsContainer .PASS
{
   color: green;
}

.qSequentialWorkflow .testForm .resultsContainer .FAIL
{
   color: red;
}

.qSequentialWorkflow .testForm .resultsContainer .ERROR
{
   color: orange;
}

.qSequentialWorkflow .material-icons
{
   font-family: 'Material Icons';
}

.qSequentialWorkflow .material-icons-round
{
   font-family: 'Material Icons Round';
}

.qSequentialWorkflow .testForm .resultsContainer .material-icons
{
   top: 4px;
   position: relative;
   font-size: 16px;
}

.qSequentialWorkflow .testForm .resultsContainer .disclosure .material-icons
{
   top: 5px;
   font-size: 20px;
   cursor: pointer;
}

.qSequentialWorkflow .sqd-smart-editor .tabsBar
{
   border-bottom: 1px solid black;
   margin: 0 -1rem 1rem;
   padding-left: 0.5rem;
}

.qSequentialWorkflow .sqd-smart-editor .tab
{
   font-size: 1rem;
   display: inline-block;
   padding: 0.25rem 0.5rem;
   border: 1px solid gray;
   border-top-left-radius: 0.5rem;
   border-top-right-radius: 0.5rem;
   position: relative;
   top: 1px;
   background: #f0f0f0;
   cursor: pointer;
}

.qSequentialWorkflow .sqd-smart-editor .tab + .tab
{
   border-left: none;
}

.qSequentialWorkflow .sqd-smart-editor .tab.active
{
   border-bottom: 1px solid white;
   background: white;
   cursor: default;
}

@keyframes spin
{
   from
   {
      transform: rotate(0deg);
   }
   to
   {
      transform: rotate(360deg);
   }
}

.qSequentialWorkflow .sqd-smart-editor .icon-spin
{
   display: inline-block;
   animation: spin 2s linear infinite;
   vertical-align: middle;
   width: 16px;
   height: 16px;
   border: 1px solid white;
}

.qSequentialWorkflow .sqd-smart-editor .icon-spin .material-icons
{
   top: -1px;
   left: -1px;
}

.fieldErrorMessage
{
   color: red;
   font-size: 0.857rem;
}

/* todo for click-to-add-step within graph
.qSequentialWorkflow:not(.readonly) .sqd-placeholder
{
   visibility: visible !important;
   opacity: 0.1;
}

.qSequentialWorkflow:not(.readonly) .sqd-placeholder:hover
{
   opacity: 0.5;
   cursor: copy;
}
 */
`, "",{"version":3,"sources":["webpack://./src/component/styles.css"],"names":[],"mappings":"AAAA;;GAEG,6BAA6B;GAC7B,2BAA2B;GAC3B,gCAAgC;GAChC,yBAAyB;GACzB,wBAAwB;GACxB,0BAA0B;GAC1B,sBAAsB;GACtB,sBAAsB;GACtB,sBAAsB;GACtB,yBAAyB;AAC5B;;AAEA;;GAEG,WAAW;GACX,YAAY;AACf;;AAEA;;;GAGG,YAAY;AACf;;AAEA;;GAEG,mBAAmB;AACtB;;AAEA;;GAEG,4BAA4B;AAC/B;;AAEA;;GAEG,gBAAgB;GAChB,gBAAgB;GAChB,UAAU;AACb;;AAEA;;GAEG,YAAY;GACZ,WAAW;GACX,QAAQ;GACR,6BAA6B;GAC7B,gBAAgB;AACnB;;AAEA;;GAEG,uCAAuC;AAC1C;;AAEA;;;;GAIG,kCAAkC;AACrC;;AAEA;;GAEG,mBAAmB;AACtB;;AAEA;;GAEG,MAAM;GACN,OAAO;GACP,yBAAyB;GACzB,YAAY;AACf;;AAEA;;GAEG,sCAAsC;AACzC;;AAEA;;GAEG,gDAA4jB;AAC/jB;;AAEA;;GAEG,6BAA6B;AAChC;;AAEA;;GAEG,+BAA+B;AAClC;;AAEA;;GAEG,WAAW;AACd;;AAEA;;GAEG,aAAa;AAChB;;AAEA;;GAEG,gBAAgB;AACnB;;AAEA;;;GAGG,aAAa;AAChB;;AAEA;;GAEG,aAAa;AAChB;;AAEA;;GAEG,eAAe;AAClB;;AAEA;;GAEG,aAAa;GACb,cAAc;GACd,+BAA+B;AAClC;;AAEA;;GAEG,qBAAqB;GACrB,kBAAkB;AACrB;;AAEA;;GAEG,cAAc;AACjB;;AAEA;;GAEG,eAAe;AAClB;;AAEA;;GAEG,gBAAgB;AACnB;;AAEA;;GAEG,qCAAqC;GACrC,8CAA8C;GAC9C,iCAAiC;GACjC,4BAA4B;AAC/B;;;AAGA;;;;GAIG,aAAa;AAChB;;AAEA;;;GAGG,aAAa;AAChB;;AAEA;;GAEG,mBAAmB;GACnB,uBAAuB;GACvB,YAAY;GACZ,WAAW;GACX,aAAa;GACb,mBAAmB;GACnB,kBAAkB;GAClB,aAAa;GACb,kCAAkC;AACrC;;AAEA;;;;GAIG,0BAA0B;AAC7B;;AAEA;;GAEG,0BAA0B;AAC7B;;AAEA;;GAEG,wBAAwB;AAC3B;;AAEA;;GAEG,eAAe;AAClB;;AAEA;;GAEG,kBAAkB;AACrB;;AAEA;;GAEG,eAAe;AAClB;;AAEA;;;;;GAKG,2BAA2B;GAC3B,eAAe;AAClB;;;AAGA;;;;;;GAMG,WAAW;GACX,eAAe;GACf,eAAe;GACf,sDAAsD;AACzD;;AAEA;;;;;;GAMG,eAAe;GACf,eAAe;GACf,WAAW;AACd;;;AAGA;;;;GAIG,0BAA0B;GAC1B,eAAe;AAClB;;AAEA;;;;;;GAMG,6BAA6B;GAC7B,eAAe;GACf,eAAe;AAClB;;AAEA;;;GAGG,WAAW;AACd;;AAEA;;GAEG,aAAa;AAChB;;AAEA;;;GAGG,0BAA0B;GAC1B,eAAe;AAClB;;AAEA;;;;GAIG,4BAA4B;AAC/B;;AAEA;;GAEG,aAAa;GACb,wBAAwB;AAC3B;;AAEA;;GAEG,iBAAiB;AACpB;;AAEA,sCAAsC;AACtC;;GAEG,kBAAkB;AACrB;;AAEA;;GAEG,eAAe;AAClB;;AAEA;;GAEG,kBAAkB;GAClB,mBAAmB;GACnB,YAAY;AACf;;AAEA;;GAEG,kCAAkC;AACrC;;AAEA;;GAEG,cAAc;AACjB;;AAEA,qCAAqC;AACrC;;GAEG,cAAc;GACd,oBAAoB;AACvB;AACA;;GAEG,mBAAmB;GACnB,gBAAgB;AACnB;;AAEA;;GAEG,4BAA4B;AAC/B;;AAEA;;GAEG,eAAe;AAClB;;AAEA;;GAEG,WAAW;AACd;;AAEA;;GAEG,WAAW;AACd;;AAEA;;GAEG,aAAa;GACb,2BAA2B;GAC3B,gBAAgB;AACnB;;AAEA;;GAEG,sBAAsB;GACtB,qBAAqB;GACrB,gBAAgB;GAChB,2BAA2B;GAC3B,kCAAkC;AACrC;;AAEA;;GAEG,YAAY;GACZ,cAAc;GACd,qBAAqB;AACxB;;AAEA;;GAEG,sBAAsB;AACzB;;AAEA;;GAEG,qBAAqB;AACxB;;AAEA;;GAEG,gBAAgB;AACnB;;AAEA;;GAEG,mBAAmB;AACtB;;AAEA;;GAEG,gBAAgB;GAChB,sBAAsB;AACzB;;AAEA;;GAEG,YAAY;AACf;;AAEA;;GAEG,UAAU;AACb;;AAEA;;GAEG,aAAa;AAChB;;AAEA;;GAEG,6BAA6B;AAChC;;AAEA;;GAEG,mCAAmC;AACtC;;AAEA;;GAEG,QAAQ;GACR,kBAAkB;GAClB,eAAe;AAClB;;AAEA;;GAEG,QAAQ;GACR,eAAe;GACf,eAAe;AAClB;;AAEA;;GAEG,8BAA8B;GAC9B,oBAAoB;GACpB,oBAAoB;AACvB;;AAEA;;GAEG,eAAe;GACf,qBAAqB;GACrB,uBAAuB;GACvB,sBAAsB;GACtB,8BAA8B;GAC9B,+BAA+B;GAC/B,kBAAkB;GAClB,QAAQ;GACR,mBAAmB;GACnB,eAAe;AAClB;;AAEA;;GAEG,iBAAiB;AACpB;;AAEA;;GAEG,8BAA8B;GAC9B,iBAAiB;GACjB,eAAe;AAClB;;AAEA;;GAEG;;MAEG,uBAAuB;GAC1B;GACA;;MAEG,yBAAyB;GAC5B;AACH;;AAEA;;GAEG,qBAAqB;GACrB,kCAAkC;GAClC,sBAAsB;GACtB,WAAW;GACX,YAAY;GACZ,uBAAuB;AAC1B;;AAEA;;GAEG,SAAS;GACT,UAAU;AACb;;AAEA;;GAEG,UAAU;GACV,mBAAmB;AACtB;;AAEA;;;;;;;;;;;;EAYE","sourcesContent":[":root\r\n{\r\n   --qsqd-light-gray-bg: #e1e1e1;\r\n   --qsqd-med-gray-bg: #bbbbbb;\r\n   --qsqd-dark-gray-border: #888888;\r\n   --qsqd-dark-text: #404040;\r\n   --qsqd-med-text: #606060;\r\n   --qsqd-light-text: #808080;\r\n   --qsqd-padding: 0.5rem;\r\n   --qsqd-radius: 0.25rem;\r\n   --qsqd-accent: #0062FF;\r\n   --qsqd-highlight: #0ac42c;\r\n}\r\n\r\n.sqd-designer-react\r\n{\r\n   width: 100%;\r\n   height: 100%;\r\n}\r\n\r\n.sqd-designer,\r\n.qSequentialWorkflow\r\n{\r\n   height: 100%;\r\n}\r\n\r\n.maximized .qSequentialWorkflow .sqd-designer\r\n{\r\n   border-radius: 1rem;\r\n}\r\n\r\n.maximized .qSequentialWorkflow .sqd-smart-editor\r\n{\r\n   border-radius: 0 1rem 1rem 0;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-layout-desktop .sqd-smart-editor\r\n{\r\n   min-width: 300px;\r\n   max-width: 600px;\r\n   width: 20%;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-layout-desktop .sqd-smart-editor-toggle\r\n{\r\n   height: 36px;\r\n   z-index: 31;\r\n   right: 0;\r\n   border-top-right-radius: 1rem;\r\n   box-shadow: none;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-layout-desktop .sqd-smart-editor-toggle.sqd-collapsed\r\n{\r\n   box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);\r\n}\r\n\r\n.qSequentialWorkflow *,\r\n.sqd-drag *,\r\n.sqd-context-menu *\r\n{\r\n   font-family: helvetica, sans-serif;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-toolbox-item-text\r\n{\r\n   white-space: normal;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-toolbox\r\n{\r\n   top: 0;\r\n   left: 0;\r\n   border-radius: 1rem 0 0 0;\r\n   width: 200px;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-toolbox .sqd-scrollbox\r\n{\r\n   height: calc(100vh - 245px) !important;\r\n}\r\n\r\n.toolbox-handle-icons .qSequentialWorkflow .sqd-toolbox-item .sqd-toolbox-item-icon\r\n{\r\n   content: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTExIDE4YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTItOGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTYgNGMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyIDJ6bTAgMmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAgNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6Ii8+Cjwvc3ZnPgo=);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect\r\n{\r\n   fill: var(--qsqd-med-gray-bg);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect\r\n{\r\n   fill: var(--qsqd-light-gray-bg);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-text\r\n{\r\n   fill: black;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-root-start-stop-start circle\r\n{\r\n   fill: #007c00;\r\n}\r\n\r\n.toolbox-handle-icons .sqd-theme-light .sqd-toolbox-item .sqd-toolbox-item-icon.sqd-no-icon\r\n{\r\n   background: none;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-root-start-stop-stop circle,\r\n.qSequentialWorkflow .stop-icon-circle\r\n{\r\n   fill: #9a0000;\r\n}\r\n\r\n.qSequentialWorkflow .stop-icon-square\r\n{\r\n   fill: #FFFFFF;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-join\r\n{\r\n   stroke-width: 1;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-editor\r\n{\r\n   padding: 1rem;\r\n   overflow: auto;\r\n   max-height: calc(100vh - 10rem);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-editor h2\r\n{\r\n   /* room for the 'x' */\r\n   margin-right: 20px;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-editor .MuiGrid-root.MuiGrid-container\r\n{\r\n   margin-left: 0;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-editor .MuiGrid-root.MuiGrid-item\r\n{\r\n   padding-left: 0;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor\r\n{\r\n   line-height: 1.3;\r\n}\r\n\r\n.qswdCustomDraggedComponent\r\n{\r\n   background: var(--qsqd-light-gray-bg);\r\n   border: 1px solid var(--qsqd-dark-gray-border);\r\n   border-radius: var(--qsqd-radius);\r\n   padding: var(--qsqd-padding);\r\n}\r\n\r\n\r\n.qSequentialWorkflow.readonly .sqd-toolbox,\r\n.qSequentialWorkflow.readonly .sqd-smart-editor,\r\n.qSequentialWorkflow.readonly .sqd-smart-editor-toggle\r\n{\r\n   display: none;\r\n}\r\n\r\n.qSequentialWorkflow.readonly .sqd-control-bar-button.sqd-disabled[title=\"Undo\"],\r\n.qSequentialWorkflow.readonly .sqd-control-bar-button.sqd-disabled[title=\"Redo\"]\r\n{\r\n   display: none;\r\n}\r\n\r\n.qswdDebugPanel\r\n{\r\n   background: #d6ffd6;\r\n   border: 3px solid green;\r\n   bottom: 20px;\r\n   right: 20px;\r\n   padding: 20px;\r\n   border-radius: 20px;\r\n   position: absolute;\r\n   z-index: 9999;\r\n   font-family: helvetica, sans-serif;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-rect.sqd-selected,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-rect.sqd-selected,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-label-rect.sqd-selected\r\n{\r\n   stroke: var(--qsqd-accent);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-region.sqd-selected\r\n{\r\n   stroke: var(--qsqd-accent);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-placeholder.sqd-hover .sqd-placeholder-rect\r\n{\r\n   fill: var(--qsqd-accent);\r\n}\r\n\r\n.qSequentialWorkflow .sqd-designer .sqd-label\r\n{\r\n   font-size: 16px;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-text\r\n{\r\n   text-anchor: start;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > g > .sqd-input\r\n{\r\n   stroke-width: 1;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-text,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-name-text,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-text,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-text\r\n{\r\n   fill: var(--qsqd-dark-text);\r\n   font-size: 16px;\r\n}\r\n\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-rect,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-rect\r\n{\r\n   fill: white;\r\n   stroke: #888888;\r\n   stroke-width: 1;\r\n   filter: drop-shadow(0 1.5px 1.5px rgba(0, 0, 0, 0.15));\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-box,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .icon-container,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-container .sqd-input,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > g > .sqd-input,\r\n.qSequentialWorkflow .sqd-theme-light .step-icon-rect\r\n{\r\n   stroke: #9da3ae;\r\n   stroke-width: 1;\r\n   fill: white;\r\n}\r\n\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary .sqd-label-rect[data-qswdSelected=\"true\"],\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary .sqd-label-rect.sqd-selected,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect.sqd-selected\r\n{\r\n   stroke: var(--qsqd-accent);\r\n   stroke-width: 2;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .sqd-large-task-rect[data-qswdTraced=\"true\"],\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch .sqd-label-primary rect[data-qswdTraced=\"true\"],\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect[data-qswdTraced=\"true\"],\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect[data-qswdTraced=\"true\"],\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .sqd-step-task-rect[data-qswdTraced=\"true\"]\r\n{\r\n   stroke: var(--qsqd-highlight);\r\n   stroke-width: 2;\r\n   fill: #DBFFE3FF;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-primary > .sqd-label-rect,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-container > .sqd-label > .sqd-label-rect\r\n{\r\n   fill: white;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-switch > .sqd-label-secondary > .sqd-label-rect\r\n{\r\n   fill: #e0e0e0;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .switch-summary-text,\r\n.qSequentialWorkflow .sqd-theme-light .large-task-summary-text\r\n{\r\n   fill: var(--qsqd-med-text);\r\n   font-size: 14px;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-theme-light .switch-description-text,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-large-task .large-task-description-text,\r\n.qSequentialWorkflow .sqd-theme-light .sqd-step-task .interrupting-task-description-text\r\n{\r\n   fill: var(--qsqd-light-text);\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget\r\n{\r\n   margin: -1rem;\r\n   width: calc(100% + 2rem);\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup\r\n{\r\n   margin-top: -3rem;\r\n}\r\n\r\n/* hide the redundant \"Filter\" label */\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup h6\r\n{\r\n   visibility: hidden;\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup h5\r\n{\r\n   font-size: 1rem;\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup .widgetLabelBox button\r\n{\r\n   position: relative;\r\n   white-space: nowrap;\r\n   top: 2.25rem;\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup .advancedQueryString > div > span\r\n{\r\n   margin-bottom: 0.375rem !important;\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.filterAndColumnsSetup .advancedQueryString\r\n{\r\n   overflow: auto;\r\n}\r\n\r\n/* filter widget within row builder */\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .advancedQueryString\r\n{\r\n   overflow: auto;\r\n   margin-top: -0.75rem;\r\n}\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .advancedQueryString div\r\n{\r\n   white-space: nowrap;\r\n   line-height: 1.6;\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .rowBuilderRowForm\r\n{\r\n   max-width: calc(100% - 75px);\r\n}\r\n\r\n.qswdStepEditorWidgetWrapper .bridgedWidget.rowBuilder .editFiltersButton p\r\n{\r\n   font-size: 1rem;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-control-bar\r\n{\r\n   z-index: 31;\r\n}\r\n\r\n.qSequentialWorkflow .testForm\r\n{\r\n   width: 100%;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .scenarioButtons\r\n{\r\n   display: flex;\r\n   flex-direction: row-reverse;\r\n   margin: 0.5rem 0;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer\r\n{\r\n   border: 1px solid gray;\r\n   border-radius: 0.5rem;\r\n   overflow: hidden;\r\n   height: calc(100vh - 420px);\r\n   font-variant-numeric: tabular-nums;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer > ul\r\n{\r\n   height: 100%;\r\n   overflow: auto;\r\n   padding: 0 !important;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer > ul > li\r\n{\r\n   padding-bottom: 0.5rem;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer ul\r\n{\r\n   padding-left: 1.25rem;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer li\r\n{\r\n   list-style: none;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer ul *\r\n{\r\n   white-space: nowrap;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer ul .outputData\r\n{\r\n   white-space: pre;\r\n   font-family: monospace;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer .PASS\r\n{\r\n   color: green;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer .FAIL\r\n{\r\n   color: red;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer .ERROR\r\n{\r\n   color: orange;\r\n}\r\n\r\n.qSequentialWorkflow .material-icons\r\n{\r\n   font-family: 'Material Icons';\r\n}\r\n\r\n.qSequentialWorkflow .material-icons-round\r\n{\r\n   font-family: 'Material Icons Round';\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer .material-icons\r\n{\r\n   top: 4px;\r\n   position: relative;\r\n   font-size: 16px;\r\n}\r\n\r\n.qSequentialWorkflow .testForm .resultsContainer .disclosure .material-icons\r\n{\r\n   top: 5px;\r\n   font-size: 20px;\r\n   cursor: pointer;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor .tabsBar\r\n{\r\n   border-bottom: 1px solid black;\r\n   margin: 0 -1rem 1rem;\r\n   padding-left: 0.5rem;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor .tab\r\n{\r\n   font-size: 1rem;\r\n   display: inline-block;\r\n   padding: 0.25rem 0.5rem;\r\n   border: 1px solid gray;\r\n   border-top-left-radius: 0.5rem;\r\n   border-top-right-radius: 0.5rem;\r\n   position: relative;\r\n   top: 1px;\r\n   background: #f0f0f0;\r\n   cursor: pointer;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor .tab + .tab\r\n{\r\n   border-left: none;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor .tab.active\r\n{\r\n   border-bottom: 1px solid white;\r\n   background: white;\r\n   cursor: default;\r\n}\r\n\r\n@keyframes spin\r\n{\r\n   from\r\n   {\r\n      transform: rotate(0deg);\r\n   }\r\n   to\r\n   {\r\n      transform: rotate(360deg);\r\n   }\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor .icon-spin\r\n{\r\n   display: inline-block;\r\n   animation: spin 2s linear infinite;\r\n   vertical-align: middle;\r\n   width: 16px;\r\n   height: 16px;\r\n   border: 1px solid white;\r\n}\r\n\r\n.qSequentialWorkflow .sqd-smart-editor .icon-spin .material-icons\r\n{\r\n   top: -1px;\r\n   left: -1px;\r\n}\r\n\r\n.fieldErrorMessage\r\n{\r\n   color: red;\r\n   font-size: 0.857rem;\r\n}\r\n\r\n/* todo for click-to-add-step within graph\r\n.qSequentialWorkflow:not(.readonly) .sqd-placeholder\r\n{\r\n   visibility: visible !important;\r\n   opacity: 0.1;\r\n}\r\n\r\n.qSequentialWorkflow:not(.readonly) .sqd-placeholder:hover\r\n{\r\n   opacity: 0.5;\r\n   cursor: copy;\r\n}\r\n */\r\n"],"sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ },

/***/ "./node_modules/css-loader/dist/runtime/api.js"
/*!*****************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/api.js ***!
  \*****************************************************/
(module) {



/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
module.exports = function (cssWithMappingToString) {
  var list = [];

  // return the list of modules as css string
  list.toString = function toString() {
    return this.map(function (item) {
      var content = "";
      var needLayer = typeof item[5] !== "undefined";
      if (item[4]) {
        content += "@supports (".concat(item[4], ") {");
      }
      if (item[2]) {
        content += "@media ".concat(item[2], " {");
      }
      if (needLayer) {
        content += "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {");
      }
      content += cssWithMappingToString(item);
      if (needLayer) {
        content += "}";
      }
      if (item[2]) {
        content += "}";
      }
      if (item[4]) {
        content += "}";
      }
      return content;
    }).join("");
  };

  // import a list of modules into the list
  list.i = function i(modules, media, dedupe, supports, layer) {
    if (typeof modules === "string") {
      modules = [[null, modules, undefined]];
    }
    var alreadyImportedModules = {};
    if (dedupe) {
      for (var k = 0; k < this.length; k++) {
        var id = this[k][0];
        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }
    for (var _k = 0; _k < modules.length; _k++) {
      var item = [].concat(modules[_k]);
      if (dedupe && alreadyImportedModules[item[0]]) {
        continue;
      }
      if (typeof layer !== "undefined") {
        if (typeof item[5] === "undefined") {
          item[5] = layer;
        } else {
          item[1] = "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {").concat(item[1], "}");
          item[5] = layer;
        }
      }
      if (media) {
        if (!item[2]) {
          item[2] = media;
        } else {
          item[1] = "@media ".concat(item[2], " {").concat(item[1], "}");
          item[2] = media;
        }
      }
      if (supports) {
        if (!item[4]) {
          item[4] = "".concat(supports);
        } else {
          item[1] = "@supports (".concat(item[4], ") {").concat(item[1], "}");
          item[4] = supports;
        }
      }
      list.push(item);
    }
  };
  return list;
};

/***/ },

/***/ "./node_modules/css-loader/dist/runtime/getUrl.js"
/*!********************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/getUrl.js ***!
  \********************************************************/
(module) {



module.exports = function (url, options) {
  if (!options) {
    options = {};
  }
  if (!url) {
    return url;
  }
  url = String(url.__esModule ? url.default : url);

  // If url is already wrapped in quotes, remove them
  if (/^['"].*['"]$/.test(url)) {
    url = url.slice(1, -1);
  }
  if (options.hash) {
    url += options.hash;
  }

  // Should url be wrapped?
  // See https://drafts.csswg.org/css-values-3/#urls
  if (/["'() \t\n]|(%20)/.test(url) || options.needQuotes) {
    return "\"".concat(url.replace(/"/g, '\\"').replace(/\n/g, "\\n"), "\"");
  }
  return url;
};

/***/ },

/***/ "./node_modules/css-loader/dist/runtime/sourceMaps.js"
/*!************************************************************!*\
  !*** ./node_modules/css-loader/dist/runtime/sourceMaps.js ***!
  \************************************************************/
(module) {



module.exports = function (item) {
  var content = item[1];
  var cssMapping = item[3];
  if (!cssMapping) {
    return content;
  }
  if (typeof btoa === "function") {
    var base64 = btoa(unescape(encodeURIComponent(JSON.stringify(cssMapping))));
    var data = "sourceMappingURL=data:application/json;charset=utf-8;base64,".concat(base64);
    var sourceMapping = "/*# ".concat(data, " */");
    return [content].concat([sourceMapping]).join("\n");
  }
  return [content].join("\n");
};

/***/ },

/***/ "./node_modules/form-data/lib/browser.js"
/*!***********************************************!*\
  !*** ./node_modules/form-data/lib/browser.js ***!
  \***********************************************/
(module) {



/* eslint-env browser */
module.exports = typeof self === 'object' ? self.FormData : window.FormData;


/***/ },

/***/ "./node_modules/sequential-workflow-designer/css/designer-light.css"
/*!**************************************************************************!*\
  !*** ./node_modules/sequential-workflow-designer/css/designer-light.css ***!
  \**************************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../../style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../../style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../../style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../../style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../../style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _css_loader_dist_cjs_js_designer_light_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../../css-loader/dist/cjs.js!./designer-light.css */ "./node_modules/css-loader/dist/cjs.js!./node_modules/sequential-workflow-designer/css/designer-light.css");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());
options.insert = _style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
options.domAPI = (_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_css_loader_dist_cjs_js_designer_light_css__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_css_loader_dist_cjs_js_designer_light_css__WEBPACK_IMPORTED_MODULE_6__["default"] && _css_loader_dist_cjs_js_designer_light_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _css_loader_dist_cjs_js_designer_light_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);


/***/ },

/***/ "./node_modules/sequential-workflow-designer/css/designer.css"
/*!********************************************************************!*\
  !*** ./node_modules/sequential-workflow-designer/css/designer.css ***!
  \********************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../../style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../../style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../../style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../../style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../../style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _css_loader_dist_cjs_js_designer_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../../css-loader/dist/cjs.js!./designer.css */ "./node_modules/css-loader/dist/cjs.js!./node_modules/sequential-workflow-designer/css/designer.css");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());
options.insert = _style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
options.domAPI = (_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_css_loader_dist_cjs_js_designer_css__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_css_loader_dist_cjs_js_designer_css__WEBPACK_IMPORTED_MODULE_6__["default"] && _css_loader_dist_cjs_js_designer_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _css_loader_dist_cjs_js_designer_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);


/***/ },

/***/ "./src/component/styles.css"
/*!**********************************!*\
  !*** ./src/component/styles.css ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../../node_modules/style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../../node_modules/style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../../node_modules/style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../../node_modules/style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_styles_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../../node_modules/css-loader/dist/cjs.js!./styles.css */ "./node_modules/css-loader/dist/cjs.js!./src/component/styles.css");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());
options.insert = _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
options.domAPI = (_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_node_modules_css_loader_dist_cjs_js_styles_css__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_node_modules_css_loader_dist_cjs_js_styles_css__WEBPACK_IMPORTED_MODULE_6__["default"] && _node_modules_css_loader_dist_cjs_js_styles_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _node_modules_css_loader_dist_cjs_js_styles_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);


/***/ },

/***/ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js"
/*!****************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js ***!
  \****************************************************************************/
(module) {



var stylesInDOM = [];
function getIndexByIdentifier(identifier) {
  var result = -1;
  for (var i = 0; i < stylesInDOM.length; i++) {
    if (stylesInDOM[i].identifier === identifier) {
      result = i;
      break;
    }
  }
  return result;
}
function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var indexByIdentifier = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3],
      supports: item[4],
      layer: item[5]
    };
    if (indexByIdentifier !== -1) {
      stylesInDOM[indexByIdentifier].references++;
      stylesInDOM[indexByIdentifier].updater(obj);
    } else {
      var updater = addElementStyle(obj, options);
      options.byIndex = i;
      stylesInDOM.splice(i, 0, {
        identifier: identifier,
        updater: updater,
        references: 1
      });
    }
    identifiers.push(identifier);
  }
  return identifiers;
}
function addElementStyle(obj, options) {
  var api = options.domAPI(options);
  api.update(obj);
  var updater = function updater(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap && newObj.supports === obj.supports && newObj.layer === obj.layer) {
        return;
      }
      api.update(obj = newObj);
    } else {
      api.remove();
    }
  };
  return updater;
}
module.exports = function (list, options) {
  options = options || {};
  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];
    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDOM[index].references--;
    }
    var newLastIdentifiers = modulesToDom(newList, options);
    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];
      var _index = getIndexByIdentifier(_identifier);
      if (stylesInDOM[_index].references === 0) {
        stylesInDOM[_index].updater();
        stylesInDOM.splice(_index, 1);
      }
    }
    lastIdentifiers = newLastIdentifiers;
  };
};

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/insertBySelector.js"
/*!********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertBySelector.js ***!
  \********************************************************************/
(module) {



var memo = {};

/* istanbul ignore next  */
function getTarget(target) {
  if (typeof memo[target] === "undefined") {
    var styleTarget = document.querySelector(target);

    // Special case to return head of iframe instead of iframe itself
    if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
      try {
        // This will throw an exception if access to iframe is blocked
        // due to cross-origin restrictions
        styleTarget = styleTarget.contentDocument.head;
      } catch (e) {
        // istanbul ignore next
        styleTarget = null;
      }
    }
    memo[target] = styleTarget;
  }
  return memo[target];
}

/* istanbul ignore next  */
function insertBySelector(insert, style) {
  var target = getTarget(insert);
  if (!target) {
    throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
  }
  target.appendChild(style);
}
module.exports = insertBySelector;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/insertStyleElement.js"
/*!**********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/insertStyleElement.js ***!
  \**********************************************************************/
(module) {



/* istanbul ignore next  */
function insertStyleElement(options) {
  var element = document.createElement("style");
  options.setAttributes(element, options.attributes);
  options.insert(element, options.options);
  return element;
}
module.exports = insertStyleElement;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js"
/*!**********************************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js ***!
  \**********************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {



/* istanbul ignore next  */
function setAttributesWithoutAttributes(styleElement) {
  var nonce =  true ? __webpack_require__.nc : 0;
  if (nonce) {
    styleElement.setAttribute("nonce", nonce);
  }
}
module.exports = setAttributesWithoutAttributes;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/styleDomAPI.js"
/*!***************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleDomAPI.js ***!
  \***************************************************************/
(module) {



/* istanbul ignore next  */
function apply(styleElement, options, obj) {
  var css = "";
  if (obj.supports) {
    css += "@supports (".concat(obj.supports, ") {");
  }
  if (obj.media) {
    css += "@media ".concat(obj.media, " {");
  }
  var needLayer = typeof obj.layer !== "undefined";
  if (needLayer) {
    css += "@layer".concat(obj.layer.length > 0 ? " ".concat(obj.layer) : "", " {");
  }
  css += obj.css;
  if (needLayer) {
    css += "}";
  }
  if (obj.media) {
    css += "}";
  }
  if (obj.supports) {
    css += "}";
  }
  var sourceMap = obj.sourceMap;
  if (sourceMap && typeof btoa !== "undefined") {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  }

  // For old IE
  /* istanbul ignore if  */
  options.styleTagTransform(css, styleElement, options.options);
}
function removeStyleElement(styleElement) {
  // istanbul ignore if
  if (styleElement.parentNode === null) {
    return false;
  }
  styleElement.parentNode.removeChild(styleElement);
}

/* istanbul ignore next  */
function domAPI(options) {
  if (typeof document === "undefined") {
    return {
      update: function update() {},
      remove: function remove() {}
    };
  }
  var styleElement = options.insertStyleElement(options);
  return {
    update: function update(obj) {
      apply(styleElement, options, obj);
    },
    remove: function remove() {
      removeStyleElement(styleElement);
    }
  };
}
module.exports = domAPI;

/***/ },

/***/ "./node_modules/style-loader/dist/runtime/styleTagTransform.js"
/*!*********************************************************************!*\
  !*** ./node_modules/style-loader/dist/runtime/styleTagTransform.js ***!
  \*********************************************************************/
(module) {



/* istanbul ignore next  */
function styleTagTransform(css, styleElement) {
  if (styleElement.styleSheet) {
    styleElement.styleSheet.cssText = css;
  } else {
    while (styleElement.firstChild) {
      styleElement.removeChild(styleElement.firstChild);
    }
    styleElement.appendChild(document.createTextNode(css));
  }
}
module.exports = styleTagTransform;

/***/ },

/***/ "./src/component/ModelProcessor.ts"
/*!*****************************************!*\
  !*** ./src/component/ModelProcessor.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData.js");
/* harmony import */ var sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! sequential-workflow-designer */ "./node_modules/sequential-workflow-designer/lib/esm/index.js");
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};


/***************************************************************************
 ** class full of methods to working with Model objects - e.g., converting
 ** from the UI's models to the backend's, and vice versa, factories, etc.
 ***************************************************************************/
var ModelProcessor = /** @class */ (function () {
    function ModelProcessor() {
    }
    /***************************************************************************
     ** Take values that we got in a process-result from the backend to define a
     ** workflow type and its step types, to fully populated objects that the
     ** rest of the javascript app can use.
     ***************************************************************************/
    ModelProcessor.convertProcessValuesToWorkflowTypeModel = function (processValues) {
        var _a;
        var workflowType = processValues.workflowType;
        var workflowStepTypes = processValues.workflowStepTypes;
        for (var key in workflowStepTypes) {
            var workflowStepType = workflowStepTypes[key];
            var actualFields = [];
            for (var _i = 0, _b = (_a = workflowStepType.inputFields) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
                var inputFieldObject = _b[_i];
                actualFields.push(new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData(inputFieldObject));
            }
            workflowStepType.inputFields = actualFields;
            if (!workflowStepType.iconUrl) {
                if (workflowStepType.outboundLinkMode === "ZERO") {
                    workflowStepType.iconUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTUgMTFIN3YtMmgxMHYyeiIvPgo8L3N2Zz4K";
                }
                else if (workflowStepType.outboundLinkMode === "ONE") {
                    workflowStepType.iconUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6TTkuNSAxNi41di05bDcgNC41LTcgNC41eiIvPgo8L3N2Zz4K";
                }
                else if (workflowStepType.outboundLinkMode === "TWO") {
                    workflowStepType.iconUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTE0IDIwIGwyLjI5IC0yLjI5IGwtMi44OCAtMi44OCBsMS40MiAtMS40MiBsMi44OCAyLjg4IEwyMCAxNCBWMjAgeiBtLTQgMCBINCB2LTYgbDIuMjkgMi4yOSBsNC43MSAtNC43IFY0IGgyIHY4LjQxIGwtNS4yOSA1LjMgeiIvPgo8L3N2Zz4K";
                }
                else if (workflowStepType.outboundLinkMode === "VARIABLE") {
                    workflowStepType.iconUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0ibTE0IDQgMi4yOSAyLjI5LTIuODggMi44OCAxLjQyIDEuNDIgMi44OC0yLjg4TDIwIDEwVjR6bS00IDBINHY2bDIuMjktMi4yOSA0LjcxIDQuN1YyMGgydi04LjQxbC01LjI5LTUuM3oiLz4KPC9zdmc+Cg==";
                }
            }
        }
        return ({ workflowType: workflowType, workflowStepTypes: workflowStepTypes });
    };
    /***************************************************************************
     ** Take values that we got in a process-result from the backend as the
     ** current version of a workflow and revision, and make sure those are
     ** valid JS objects for the application to use.
     ***************************************************************************/
    ModelProcessor.convertProcessValuesToWorkflowModels = function (processValues) {
        var workflowRevision = processValues.workflowRevision;
        if (typeof workflowRevision == "string") {
            workflowRevision = JSON.parse(workflowRevision);
        }
        var workflow = processValues.workflow;
        if (typeof workflow == "string") {
            workflow = JSON.parse(workflow);
        }
        return ({ workflow: workflow, workflowRevision: workflowRevision });
    };
    /***************************************************************************
     ** Convert from the SWD model used in SWD library to the expected model for
     ** the backend (e.g, a list of steps & links).
     ** e.g., handle getting ready to save.
     ***************************************************************************/
    ModelProcessor.swdStepListToWorkflowStepsAndLinks = function (swdSteps, workflowSteps, workflowLinks, ids, callDepth) {
        if (callDepth === void 0) { callDepth = 0; }
        var lastStepNo = null;
        var lastStep = null;
        var lastStepWasBranch = false;
        var lastStepWasContainer = false;
        var endsOfLastBranches = new Set();
        var _loop_1 = function (swdStep) {
            var inputValues = __assign({}, swdStep.properties);
            delete inputValues.qswdDescription;
            delete inputValues.qswdStepNo;
            var step = {
                stepNo: this_1.getStepNo(swdStep, ids),
                workflowStepTypeName: swdStep.type,
                description: swdStep.properties.qswdDescription ? String(swdStep.properties.qswdDescription) : "",
                inputValuesJson: JSON.stringify(inputValues)
            };
            workflowSteps.push(step);
            if (lastStepNo) {
                if (lastStepWasBranch) {
                    endsOfLastBranches.forEach(function (endOfBranch) {
                        var link = {
                            fromStepNo: endOfBranch.stepNo,
                            toStepNo: step.stepNo
                        };
                        if (endOfBranch.conditionValue) {
                            link.conditionValue = endOfBranch.conditionValue;
                        }
                        workflowLinks.push(link);
                    });
                }
                else if (lastStepWasContainer) {
                    var link = {
                        fromStepNo: lastStepNo,
                        toStepNo: step.stepNo,
                        conditionValue: "pop"
                    };
                    workflowLinks.push(link);
                }
                else {
                    var link = {
                        fromStepNo: lastStepNo,
                        toStepNo: step.stepNo
                    };
                    workflowLinks.push(link);
                }
            }
            lastStepNo = step.stepNo;
            lastStep = swdStep;
            lastStepWasBranch = false;
            endsOfLastBranches.clear();
            lastStepWasContainer = false;
            var branches = swdStep.branches;
            if (branches) {
                lastStepWasBranch = true;
                for (var branchesKey in branches) {
                    var branchSequence = branches[branchesKey];
                    if (branchSequence && branchSequence.length > 0) {
                        var lastStepNosInBranch = this_1.swdStepListToWorkflowStepsAndLinks(branchSequence, workflowSteps, workflowLinks, ids, callDepth + 1);
                        if (lastStepNosInBranch) {
                            lastStepNosInBranch.forEach(function (s) { return endsOfLastBranches.add(s); });
                        }
                        var link = {
                            fromStepNo: this_1.getStepNo(swdStep, ids),
                            toStepNo: this_1.getStepNo(branches[branchesKey][0], ids),
                            conditionValue: branchesKey
                        };
                        workflowLinks.push(link);
                    }
                    else {
                        var link = {
                            fromStepNo: this_1.getStepNo(swdStep, ids),
                            toStepNo: null,
                            conditionValue: branchesKey
                        };
                        workflowLinks.push(link);
                        endsOfLastBranches.add({ stepNo: step.stepNo, conditionValue: branchesKey, step: swdStep });
                    }
                }
            }
            var subSequence = swdStep.sequence;
            if (subSequence) {
                lastStepWasContainer = true;
                if (subSequence.length > 0) {
                    var lastStepNosInBranch = this_1.swdStepListToWorkflowStepsAndLinks(subSequence, workflowSteps, workflowLinks, ids, callDepth + 1);
                    if (lastStepNosInBranch) {
                        lastStepNosInBranch.forEach(function (s) { return endsOfLastBranches.add(s); });
                    }
                    var link = {
                        fromStepNo: this_1.getStepNo(swdStep, ids),
                        toStepNo: this_1.getStepNo(subSequence[0], ids),
                        conditionValue: "push"
                    };
                    workflowLinks.push(link);
                }
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = swdSteps !== null && swdSteps !== void 0 ? swdSteps : []; _i < _a.length; _i++) {
            var swdStep = _a[_i];
            _loop_1(swdStep);
        }
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        // on the top-level call (depth 0), clean up any cases where more than one link was built with a  //
        // matching fromStepNo & conditionValue, once with a toStep of null, and another time as non-null //
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        if (callDepth == 0) {
            //////////////////////////////////////////////////////////////////
            // build set of the workflow links that have a non-null to-step //
            //////////////////////////////////////////////////////////////////
            var nonNullToStepLinks = {};
            for (var _b = 0, workflowLinks_1 = workflowLinks; _b < workflowLinks_1.length; _b++) {
                var workflowLink = workflowLinks_1[_b];
                if (workflowLink.toStepNo !== null) {
                    nonNullToStepLinks[workflowLink.fromStepNo + "|" + workflowLink.conditionValue] = true;
                }
            }
            /////////////////////////////////////////////////////////////////////
            // go back through the links, and any that have a null to-step, if //
            // they also had a non-null one, then splice away the null one.    //
            // in other words, non-null links have priority over null ones.    //
            /////////////////////////////////////////////////////////////////////
            for (var i = 0; i < workflowLinks.length; i++) {
                var workflowLink = workflowLinks[i];
                if (workflowLink.toStepNo === null) {
                    if (nonNullToStepLinks[workflowLink.fromStepNo + "|" + workflowLink.conditionValue]) {
                        workflowLinks.splice(i, 1);
                        i--;
                    }
                }
            }
        }
        if (lastStepWasBranch || lastStepWasContainer) {
            return endsOfLastBranches;
        }
        else {
            var rs = new Set();
            if (lastStepNo && lastStep) {
                rs.add({ stepNo: lastStepNo, step: lastStep });
            }
            return (rs);
        }
    };
    /***************************************************************************
     *
     ***************************************************************************/
    ModelProcessor.getStepNo = function (swdStep, ids) {
        var _a;
        var stepNo = swdStep.properties.qswdStepNo == null ? null : Number(swdStep.properties.qswdStepNo);
        if (stepNo == null) {
            if (!ids[swdStep.id]) {
                ids[swdStep.id] = 1 + ((_a = Object.keys(ids).length) !== null && _a !== void 0 ? _a : 0);
            }
            stepNo = ids[swdStep.id];
        }
        return stepNo;
    };
    /***************************************************************************
     ** Take a workflow revision object as stored in our backend, and convert it
     ** to the model (Definition) that the SWD js app works with.
     ** e.g., handle loading up the js app.
     ***************************************************************************/
    ModelProcessor.workflowRevisionToSwdDefinition = function (workflow, workflowRevision, workflowStepTypes, executedStepIds, stepOutputMap, stepLogMessageMap, isSwdPro) {
        var _a;
        if (isSwdPro === void 0) { isSwdPro = false; }
        var blank = { properties: {}, sequence: [] };
        if (!workflowRevision) {
            return (blank);
        }
        var properties = {
            workflowName: (_a = workflow === null || workflow === void 0 ? void 0 : workflow.name) !== null && _a !== void 0 ? _a : "Workflow",
            versionNo: workflowRevision.versionNo,
            apiName: workflowRevision.apiName,
            apiVersion: workflowRevision.apiVersion,
        };
        var steps = workflowRevision.steps;
        var links = workflowRevision.links;
        if (!steps || steps.length === 0) {
            return { properties: properties, sequence: [] };
        }
        var stepMap = {};
        steps.forEach(function (step) { return stepMap[step.stepNo] = step; });
        var linksFromMap = {};
        links === null || links === void 0 ? void 0 : links.forEach(function (link) {
            var _a, _b;
            var subMap = (_a = linksFromMap[link.fromStepNo]) !== null && _a !== void 0 ? _a : {};
            subMap[(_b = link.conditionValue) !== null && _b !== void 0 ? _b : ""] = link;
            linksFromMap[link.fromStepNo] = subMap;
        });
        var linksToMap = {};
        links === null || links === void 0 ? void 0 : links.forEach(function (link) {
            var _a;
            if (link.toStepNo !== null) {
                var subMap = (_a = linksToMap[link.toStepNo]) !== null && _a !== void 0 ? _a : {};
                subMap[link.fromStepNo] = true;
                linksToMap[link.toStepNo] = subMap;
            }
        });
        var sequence = [];
        var startStep = stepMap[workflowRevision.startStepNo];
        this.convertWorkflowStepToSwdStep(sequence, startStep, workflowStepTypes, stepMap, linksFromMap, null, 0, executedStepIds !== null && executedStepIds !== void 0 ? executedStepIds : [], stepOutputMap !== null && stepOutputMap !== void 0 ? stepOutputMap : {}, stepLogMessageMap !== null && stepLogMessageMap !== void 0 ? stepLogMessageMap : {}, isSwdPro);
        return { properties: properties, sequence: sequence };
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.convertWorkflowStepToSwdStep = function (swdSteps, workflowStep, workflowStepTypes, stepMap, linksFromMap, joinStepNo, depth, executedStepIds, stepOutputMap, stepLogMessageMap, isSwdPro) {
        var _a;
        if (isSwdPro === void 0) { isSwdPro = false; }
        var currentWorkflowStep = workflowStep;
        while (currentWorkflowStep != null) {
            var workflowStepType = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[currentWorkflowStep.workflowStepTypeName];
            if (!workflowStepType) {
                console.warn("Unrecognized step type: " + currentWorkflowStep.workflowStepTypeName + "");
                return;
            }
            if (currentWorkflowStep.stepNo == joinStepNo) {
                return;
            }
            var step = this.createWorkflowStep(workflowStepType, currentWorkflowStep, isSwdPro);
            swdSteps.push(step);
            if (currentWorkflowStep.inputValuesJson) {
                if (typeof currentWorkflowStep.inputValuesJson === "object") {
                    step.properties = currentWorkflowStep.inputValuesJson;
                }
                else if (typeof currentWorkflowStep.inputValuesJson === "string") {
                    step.properties = JSON.parse(currentWorkflowStep.inputValuesJson);
                }
            }
            step.properties.qswdStepNo = currentWorkflowStep.stepNo;
            step.name = "".concat(currentWorkflowStep.stepNo, ": ").concat(step.name);
            if (currentWorkflowStep.id) {
                if (executedStepIds.indexOf(currentWorkflowStep.id) > -1) {
                    step.properties.isTraced = true;
                }
                if (stepOutputMap[currentWorkflowStep.id] !== undefined) {
                    step.properties.output = stepOutputMap[currentWorkflowStep.id];
                }
                if (stepLogMessageMap[currentWorkflowStep.id] !== undefined) {
                    step.properties.logMessage = stepLogMessageMap[currentWorkflowStep.id];
                }
            }
            if (currentWorkflowStep.summary) {
                step.properties.summary = currentWorkflowStep.summary;
            }
            if (currentWorkflowStep.description) {
                step.properties.qswdDescription = currentWorkflowStep.description;
            }
            var outboundLinks = linksFromMap[currentWorkflowStep.stepNo];
            if (!outboundLinks || Object.keys(outboundLinks).length == 0) {
                //////////////////////////////////////////////////////////////////////
                // no more next steps - only terminal steps at the end of the graph //
                //////////////////////////////////////////////////////////////////////
                currentWorkflowStep = null;
            }
            else if (Object.keys(outboundLinks).length == 1 && !Object.keys(outboundLinks)[0]) // avoid being tripped by a branch w/ only 1 side populated at the end of the graph.
             {
                ///////////////////////////////////////////////////////////////////
                // 1 outbound link here means we're not in a switch/if-else/fork //
                ///////////////////////////////////////////////////////////////////
                var conditionValue = Object.keys(outboundLinks)[0];
                var outboundLink = outboundLinks[conditionValue];
                currentWorkflowStep = outboundLink.toStepNo !== null ? stepMap[outboundLink.toStepNo] : null;
                ////////////////////////////////
                // todo is this == null okay? //
                ////////////////////////////////
                if (currentWorkflowStep == null || currentWorkflowStep.stepNo == joinStepNo) {
                    ///////////////////////////////////////////////////////
                    // this means we're ending a nested (recursive) call //
                    ///////////////////////////////////////////////////////
                    return;
                }
            }
            else {
                if ((workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.outboundLinkMode) == "TWO" || (workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.outboundLinkMode) == "VARIABLE") {
                    ///////////////////////////////////////////////////////////////////////////////////////////////////
                    // this means we are starting a fork.  find where it ends - where the branches first re-converge //
                    ///////////////////////////////////////////////////////////////////////////////////////////////////
                    var branchJoin = this.findBranchJoin(outboundLinks, stepMap, linksFromMap);
                    ////////////////////////////////////////////
                    // for each branch, make a recursive call //
                    ////////////////////////////////////////////
                    for (var conditionValue in outboundLinks) {
                        var outboundLink = outboundLinks[conditionValue];
                        var branchSteps = [];
                        step.branches[conditionValue] = branchSteps;
                        if (branchJoin && branchJoin.stepNo == outboundLink.toStepNo) {
                            ////////////////////////////////////////////////////////////////////////
                            // this indicates an empty branch - so continue to next outbound link //
                            ////////////////////////////////////////////////////////////////////////
                            continue;
                        }
                        ///////////////////////////////////////////////////////////////////////////////////////////
                        // if this is a step out of the branch (e.g., to a join), then don't process it in here. //
                        // also though, this line doesn't actually get hit, so...                                //
                        ///////////////////////////////////////////////////////////////////////////////////////////
                        if (outboundLink.toStepNo == joinStepNo) {
                            continue;
                        }
                        else {
                            if (outboundLink.toStepNo !== null) {
                                this.convertWorkflowStepToSwdStep(branchSteps, stepMap[outboundLink.toStepNo], workflowStepTypes, stepMap, linksFromMap, (_a = branchJoin === null || branchJoin === void 0 ? void 0 : branchJoin.stepNo) !== null && _a !== void 0 ? _a : null, depth + 1, executedStepIds, stepOutputMap, stepLogMessageMap, isSwdPro);
                            }
                        }
                    }
                    ////////////////////////////////////////////////////////////////////////////////
                    // after handling all the branches, then continue the loop with the join step //
                    ////////////////////////////////////////////////////////////////////////////////
                    currentWorkflowStep = branchJoin ? stepMap[branchJoin.stepNo] : null;
                }
                else if ((workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.outboundLinkMode) == "CONTAINER") {
                    ///////////////////////////////////////////////////////////////////////
                    // if the container is non-empty, there should be a push link for it //
                    ///////////////////////////////////////////////////////////////////////
                    var pushLink = outboundLinks["push"];
                    if (pushLink) {
                        if (pushLink.toStepNo !== null) {
                            this.convertWorkflowStepToSwdStep(step.sequence, stepMap[pushLink.toStepNo], workflowStepTypes, stepMap, linksFromMap, null, depth + 1, executedStepIds, stepOutputMap, stepLogMessageMap, isSwdPro);
                        }
                    }
                    else {
                    }
                    var popLink = outboundLinks["pop"];
                    if (popLink) {
                        if (popLink.toStepNo !== null) {
                            currentWorkflowStep = stepMap[popLink.toStepNo];
                        }
                    }
                    else {
                        return;
                    }
                }
                else {
                    console.warn("Unexpected to have multiple outbound links for a step of type: " + currentWorkflowStep.workflowStepTypeName + "");
                }
            }
        }
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.findBranchJoin = function (outboundLinks, stepMap, linksFromMap) {
        var startNodes = [];
        ///////////////////////////////////////////////////////////////////////////////////////////////
        // if there's only 1 outbound link - so far we think that means it must be a half-populated  //
        // branch at the end of the graph - in which case, there is no join point, so we return null //
        ///////////////////////////////////////////////////////////////////////////////////////////////
        if (Object.keys(outboundLinks).length == 1) {
            return (null);
        }
        var startNodesMap = {};
        var anyToNull = false;
        for (var conditionValue in outboundLinks) {
            var stepNo = outboundLinks[conditionValue].toStepNo;
            if (stepNo == null) {
                anyToNull = true;
            }
            else {
                startNodes.push(stepMap[stepNo]);
                startNodesMap[stepNo] = true;
            }
        }
        if (Object.keys(startNodesMap).length == 1 && !anyToNull) {
            ////////////////////////////////////////////////////////////////////////////////////////
            // if none of the branches have any steps, then they'll all have the same start-node  //
            // (e.g., the same to-step in their link) - so return the common step after them all  //
            // noting that, if any of the outboundLinks were to a null step (e.g., end of graph), //
            // then that means the start step (which is just on one leg) isn't the common join,   //
            // so we do need to run the findFirstJoinPoint (BFS) algorithm                        //
            ////////////////////////////////////////////////////////////////////////////////////////
            return startNodes[0];
        }
        return (this.findFirstJoinPoint(startNodes, stepMap, linksFromMap));
    };
    /***************************************************************************
     ** Credit: https://chatgpt.com/share/68000e8f-879c-8011-bb33-0564eb77a1f2
     ***************************************************************************/
    ModelProcessor.findFirstJoinPoint = function (startNodes, nodeMap, outEdges) {
        // visited: map each node to a set of source step numbers that have reached it.
        var visited = new Map();
        // Initialize the multi-source BFS queue. Each entry carries the current node id and its originating source.
        var queue = [];
        // Seed the queue with each starting node, marking each as visited by itself.
        for (var _i = 0, startNodes_1 = startNodes; _i < startNodes_1.length; _i++) {
            var node = startNodes_1[_i];
            visited.set(node.stepNo, new Set([node.stepNo]));
            queue.push({ current: node.stepNo, source: node.stepNo });
        }
        // Perform the multi-source BFS.
        while (queue.length > 0) {
            var _a = queue.shift(), current = _a.current, source = _a.source;
            // Get the list of outgoing links/neighbors for the current node.
            var neighbors = outEdges[current] || {};
            for (var conditionValue in neighbors) {
                var neighborId = neighbors[conditionValue].toStepNo;
                if (neighborId == null) {
                    continue;
                }
                // const neighborId = link.toStepNo;
                // Retrieve or initialize the set of sources that visited this neighbor.
                var sourcesSet = visited.get(neighborId);
                if (!sourcesSet) {
                    sourcesSet = new Set();
                    visited.set(neighborId, sourcesSet);
                }
                // If the current source has not visited the neighbor yet, add it.
                if (!sourcesSet.has(source)) {
                    sourcesSet.add(source);
                    // Check if the neighbor was reached from multiple sources.
                    if (sourcesSet.size > 1) {
                        // This is the first join point encountered – return the corresponding WorkflowStep.
                        return nodeMap[neighborId] || null;
                    }
                    // Continue the BFS from this neighbor for the current source.
                    queue.push({ current: neighborId, source: source });
                }
            }
        }
        // If no join point was found across all paths, return null.
        return null;
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.validateSwdDefinitionBeforeSave = function (swdSteps, workflowStepTypes, definition, workflowRevision) {
        if (!this.validateDefinition(definition, workflowRevision)) {
            return ({ isValid: false, error: "The workflow is not fully configured." });
        }
        ////////////////////////////////////////////////////////////////////////
        // first look for invalid steps - e.g., missing required input values //
        ////////////////////////////////////////////////////////////////////////
        var ids = {};
        var invalidStepNos = [];
        for (var _i = 0, swdSteps_1 = swdSteps; _i < swdSteps_1.length; _i++) {
            var step = swdSteps_1[_i];
            invalidStepNos.push.apply(invalidStepNos, this.validateSwdStepAndChildren(step, workflowStepTypes, ids));
        }
        if (invalidStepNos.length > 0) {
            /////////////////////////////////////////////////////////////////////////////////////////////
            // put 'and' before last step no if there's more than 1                                    //
            // if there's only 1, just output it - else join with ', ' if there's > 2, else just space //
            // so we get in the end:                                                                   //
            // [x] => [x] => x                                                                         //
            // [x, y] => [x, and y] => x and y                                                         //
            // [x, y, z] => [x, y, and z] => x, y, and z                                               //
            /////////////////////////////////////////////////////////////////////////////////////////////
            var stepNosWithAndBeforeLastIfNeeded = invalidStepNos.map(function (stepNo, index) { return (invalidStepNos.length > 1 && index == invalidStepNos.length - 1 ? "and ".concat(stepNo) : String(stepNo)); });
            var message = (invalidStepNos.length == 1 ? "Step ".concat(invalidStepNos[0], " is ") : "Steps ".concat(stepNosWithAndBeforeLastIfNeeded.join(invalidStepNos.length > 2 ? ", " : " "), " are ")) + " not fully configured.";
            return ({ isValid: false, error: message });
        }
        ///////////////////////////////////////////////////////////////////////////////////////
        // next build the steps & links we'll submit to the backend - to check for bad links //
        ///////////////////////////////////////////////////////////////////////////////////////
        var steps = [];
        var links = [];
        ModelProcessor.swdStepListToWorkflowStepsAndLinks(swdSteps, steps, links, ids);
        ////////////////////////////////////////////////////////////////////////////////////
        // this logic is no longer valid - as we ARE building a link from a ZERO outbound //
        // step to its next step, to help understand if steps on the other side of an if  //
        // are inside or outside of it.                                                   //
        ////////////////////////////////////////////////////////////////////////////////////
        /*
        //////////////////////////////////////////////////////////////////////
        // look for any step who should have 0 outbound links, but has some //
        //////////////////////////////////////////////////////////////////////
        const linksFromZeroOutboundStepTypes = this.countStepsWithZeroOutboundLinksHaveALink(steps, links, workflowStepTypes)
        if(linksFromZeroOutboundStepTypes > 0)
        {
           return ({isValid: false, error: `${linksFromZeroOutboundStepTypes == 1 ? "One step " : `${linksFromZeroOutboundStepTypes} steps `} that should not have a next-step ${linksFromZeroOutboundStepTypes == 1 ? "does" : "do"}.`});
        }
        */
        //////////////////////////////////////////////////////////////////
        // look for any disconnected step - e.g., with no inbound links //
        //////////////////////////////////////////////////////////////////
        var disconnectedStepNos = this.getDisconnectedStepNos(steps, links, workflowStepTypes);
        if (disconnectedStepNos.length > 0) {
            return ({ isValid: false, error: "".concat(disconnectedStepNos.length == 1 ? "Step ".concat(disconnectedStepNos[0], " is") : "Steps ".concat(disconnectedStepNos.join(", "), " are "), " not accessible from any other step") });
        }
        return ({ isValid: true });
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.getDisconnectedStepNos = function (steps, links, workflowStepTypes) {
        var _a;
        var firstStepNo = steps[0].stepNo;
        var rs = [];
        var stepMap = new Map();
        for (var _i = 0, steps_1 = steps; _i < steps_1.length; _i++) {
            var step = steps_1[_i];
            stepMap.set(step.stepNo, step);
        }
        var toStepNoSet = new Set();
        for (var _b = 0, links_1 = links; _b < links_1.length; _b++) {
            var link = links_1[_b];
            var fromStep = stepMap.get(link.fromStepNo);
            var stepType = workflowStepTypes[(_a = fromStep === null || fromStep === void 0 ? void 0 : fromStep.workflowStepTypeName) !== null && _a !== void 0 ? _a : ""];
            if ((stepType === null || stepType === void 0 ? void 0 : stepType.outboundLinkMode) == "ZERO") {
                ////////////////////////////////////////////////////
                // don't count links out of a ZERO link-mode step //
                ////////////////////////////////////////////////////
            }
            else if (link.toStepNo !== null) {
                toStepNoSet.add(link.toStepNo);
            }
        }
        var count = 0;
        for (var _c = 0, steps_2 = steps; _c < steps_2.length; _c++) {
            var step = steps_2[_c];
            if (!toStepNoSet.has(step.stepNo) && step.stepNo != firstStepNo) {
                rs.push(step.stepNo);
            }
        }
        return rs;
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.countStepsWithZeroOutboundLinksHaveALink = function (steps, links, workflowStepTypes) {
        var _a;
        var stepMap = new Map();
        for (var _i = 0, steps_3 = steps; _i < steps_3.length; _i++) {
            var step = steps_3[_i];
            stepMap.set(step.stepNo, step);
        }
        var count = 0;
        for (var _b = 0, links_2 = links; _b < links_2.length; _b++) {
            var link = links_2[_b];
            var fromStep = stepMap.get(link.fromStepNo);
            var stepType = workflowStepTypes[(_a = fromStep === null || fromStep === void 0 ? void 0 : fromStep.workflowStepTypeName) !== null && _a !== void 0 ? _a : ""];
            if ((stepType === null || stepType === void 0 ? void 0 : stepType.outboundLinkMode) == "ZERO") {
                count++;
            }
        }
        return count;
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.validateSwdStepAndChildren = function (step, workflowStepTypes, ids) {
        var invalidStepNos = [];
        if (!this.validateSwdStep(step, workflowStepTypes)) {
            invalidStepNos.push(this.getStepNo(step, ids));
        }
        var branches = step.branches;
        if (branches) {
            for (var condition in branches) {
                var branch = branches[condition];
                for (var _i = 0, branch_1 = branch; _i < branch_1.length; _i++) {
                    var subStep = branch_1[_i];
                    invalidStepNos.push.apply(invalidStepNos, this.validateSwdStepAndChildren(subStep, workflowStepTypes, ids));
                }
            }
        }
        var subSequence = step.sequence;
        if (subSequence) {
            for (var _a = 0, subSequence_1 = subSequence; _a < subSequence_1.length; _a++) {
                var subStep = subSequence_1[_a];
                invalidStepNos.push.apply(invalidStepNos, this.validateSwdStepAndChildren(subStep, workflowStepTypes, ids));
            }
        }
        return (invalidStepNos);
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.validateSwdStep = function (step, workflowStepTypes) {
        var _a, _b;
        var inputFields = (_b = (_a = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[step.type]) === null || _a === void 0 ? void 0 : _a.inputFields) !== null && _b !== void 0 ? _b : [];
        for (var _i = 0, inputFields_1 = inputFields; _i < inputFields_1.length; _i++) {
            var field = inputFields_1[_i];
            var value = step.properties[field.name];
            if (field.isRequired && (value == undefined || value == "")) {
                return (false);
            }
        }
        return (true);
    };
    /***************************************************************************
     **
     ***************************************************************************/
    ModelProcessor.validateDefinition = function (definition, workflowRevision) {
        if (!(workflowRevision === null || workflowRevision === void 0 ? void 0 : workflowRevision.apiVersion) || !(workflowRevision === null || workflowRevision === void 0 ? void 0 : workflowRevision.apiName)) {
            return (false);
        }
        return (true);
    };
    /***************************************************************************
     *
     ***************************************************************************/
    ModelProcessor.createWorkflowStep = function (workflowStepType, currentWorkflowStep, isSwdPro) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (isSwdPro === void 0) { isSwdPro = false; }
        var componentType = "";
        var branches = {};
        var addBranchesEvenIfEmpty = false;
        var sequence = null;
        var properties = {};
        switch ((_a = workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.outboundLinkMode) !== null && _a !== void 0 ? _a : "ONE") {
            case "ZERO":
                componentType = isSwdPro ? "interruptingTask" : "task"; // todo if not pro need to block outbound links with: https://nocode-js.com/docs/sequential-workflow-designer/features/conditional-placeholders
                break;
            case "ONE":
                componentType = isSwdPro ? "largeTask" : "task";
                break;
            case "CONTAINER":
                componentType = "container";
                sequence = [];
                break;
            case "TWO":
                componentType = "switch";
                (_b = workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.outboundLinkOptions) === null || _b === void 0 ? void 0 : _b.forEach(function (option) {
                    branches[option.value] = [];
                });
                break;
            case "VARIABLE":
                /////////////////////////////////////////////////////////////////////////////////////////
                // variable outbound links are a switch for SWD - which requires at least 1 branch.    //
                // if the step has link options on it, then output those.                              //
                // else if the stepType has link options, output those.                                //
                // else add a default branch, which presumably will be replaced as the step is edited. //
                /////////////////////////////////////////////////////////////////////////////////////////
                componentType = "switch";
                var addedAnyBranches_1 = false;
                (_c = currentWorkflowStep === null || currentWorkflowStep === void 0 ? void 0 : currentWorkflowStep.outboundLinkOptions) === null || _c === void 0 ? void 0 : _c.forEach(function (option) {
                    addedAnyBranches_1 = true;
                    branches[option.value] = [];
                });
                if (!addedAnyBranches_1) {
                    (_d = workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.outboundLinkOptions) === null || _d === void 0 ? void 0 : _d.forEach(function (option) {
                        addedAnyBranches_1 = true;
                        branches[option.value] = [];
                    });
                }
                if (!addedAnyBranches_1) {
                    addBranchesEvenIfEmpty = true;
                }
                break;
        }
        var id;
        try {
            id = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_1__.Uid.next();
        }
        catch (e) {
            id = "".concat(Math.random());
        }
        (_e = workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.inputFields) === null || _e === void 0 ? void 0 : _e.forEach(function (field) {
            if (field.defaultValue) {
                properties[field.name] = field.defaultValue;
            }
        });
        var step = {
            componentType: componentType,
            id: id,
            type: (_f = workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.name) !== null && _f !== void 0 ? _f : "unknownStepType",
            name: (_g = workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.label) !== null && _g !== void 0 ? _g : "Unknown Step Type",
            properties: properties,
        };
        if (Object.keys(branches).length > 0 || addBranchesEvenIfEmpty) {
            step.branches = branches;
        }
        if (sequence != null) {
            step.sequence = sequence;
        }
        return step;
    };
    return ModelProcessor;
}());
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (ModelProcessor);


/***/ },

/***/ "./src/component/QSequentialWorkflow.tsx"
/*!***********************************************!*\
  !*** ./src/component/QSequentialWorkflow.tsx ***!
  \***********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData.js");
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/QRecord */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QRecord.js");
/* harmony import */ var form_data__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! form-data */ "./node_modules/form-data/lib/browser.js");
/* harmony import */ var form_data__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(form_data__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _styles_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./styles.css */ "./src/component/styles.css");
/* harmony import */ var sequential_workflow_designer_css_designer_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sequential-workflow-designer/css/designer.css */ "./node_modules/sequential-workflow-designer/css/designer.css");
/* harmony import */ var sequential_workflow_designer_css_designer_light_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! sequential-workflow-designer/css/designer-light.css */ "./node_modules/sequential-workflow-designer/css/designer-light.css");
/* harmony import */ var _ModelProcessor__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./ModelProcessor */ "./src/component/ModelProcessor.ts");
/* harmony import */ var _SequentialWorkflowWrapper__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./SequentialWorkflowWrapper */ "./src/component/SequentialWorkflowWrapper.tsx");
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};









/***************************************************************************
 **
 ***************************************************************************/
function readProps(props) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var widgetMetaData = props === null || props === void 0 ? void 0 : props.widgetMetaData;
    var widgetData = props === null || props === void 0 ? void 0 : props.widgetData;
    var workflowId = widgetData === null || widgetData === void 0 ? void 0 : widgetData.workflowId;
    var workflowRevisionId = widgetData === null || widgetData === void 0 ? void 0 : widgetData.workflowRevisionId;
    var executedStepIds = widgetData === null || widgetData === void 0 ? void 0 : widgetData.executedStepIds;
    var stepOutputMap = widgetData === null || widgetData === void 0 ? void 0 : widgetData.stepOutputMap;
    var stepLogMessageMap = widgetData === null || widgetData === void 0 ? void 0 : widgetData.stepLogMessageMap;
    var readonlyState = (_b = (_a = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _a === void 0 ? void 0 : _a.get("readonlyState")) !== null && _b !== void 0 ? _b : "never";
    var storeNewWorkflowRevisionProcessName = (_d = (_c = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _c === void 0 ? void 0 : _c.get("customStoreNewWorkflowRevisionProcessName")) !== null && _d !== void 0 ? _d : "storeNewWorkflowRevision";
    var includeTestForm = (_g = (_e = widgetData === null || widgetData === void 0 ? void 0 : widgetData.includeTestForm) !== null && _e !== void 0 ? _e : (_f = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _f === void 0 ? void 0 : _f.get("includeTestForm")) !== null && _g !== void 0 ? _g : false;
    var toolboxShowHandleIcons = (_j = (_h = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _h === void 0 ? void 0 : _h.get("toolboxShowHandleIcons")) !== null && _j !== void 0 ? _j : false;
    var showIconsOnSteps = (_l = (_k = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _k === void 0 ? void 0 : _k.get("showIconsOnSteps")) !== null && _l !== void 0 ? _l : true;
    var defaultCommitMessage = (_o = (_m = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _m === void 0 ? void 0 : _m.get("defaultCommitMessage")) !== null && _o !== void 0 ? _o : "";
    var isCommitMessageRequired = Boolean((_q = (_p = widgetMetaData === null || widgetMetaData === void 0 ? void 0 : widgetMetaData.defaultValues) === null || _p === void 0 ? void 0 : _p.get("isCommitMessageRequired")) !== null && _q !== void 0 ? _q : true);
    return ({
        workflowId: workflowId,
        workflowRevisionId: workflowRevisionId,
        readonlyState: readonlyState,
        storeNewWorkflowRevisionProcessName: storeNewWorkflowRevisionProcessName,
        executedStepIds: executedStepIds,
        stepOutputMap: stepOutputMap,
        stepLogMessageMap: stepLogMessageMap,
        includeTestForm: includeTestForm,
        toolboxShowHandleIcons: toolboxShowHandleIcons,
        showIconsOnSteps: showIconsOnSteps,
        defaultCommitMessage: defaultCommitMessage,
        isCommitMessageRequired: isCommitMessageRequired
    });
}
var alertId = 0;
var MODAL_IDENTIFIER = "QSequentialWorkflow";
/***************************************************************************
 **
 ***************************************************************************/
var QSequentialWorkflow = function (_a) {
    var qfmdBridge = _a.qfmdBridge, qContext = _a.qContext, props = _a.props;
    var valuesFromProps = readProps(props);
    var _b = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(valuesFromProps.workflowId), workflowId = _b[0], setWorkflowId = _b[1];
    var workflowRevisionId = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(valuesFromProps.workflowRevisionId)[0];
    var _c = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(undefined), workflowType = _c[0], setWorkflowType = _c[1];
    var _d = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(undefined), workflowStepTypes = _d[0], setWorkflowStepTypes = _d[1];
    var _e = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(undefined), workflow = _e[0], setWorkflow = _e[1];
    var _f = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(undefined), workflowRevision = _f[0], setWorkflowRevision = _f[1];
    var _g = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false), ready = _g[0], setReady = _g[1];
    var _h = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(valuesFromProps.readonlyState == "always" || valuesFromProps.readonlyState == "initially"), isReadonly = _h[0], setIsReadonly = _h[1];
    var _j = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false), isSaving = _j[0], setIsSaving = _j[1];
    var _k = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false), isMaximized = _k[0], setIsMaximized = _k[1];
    var _l = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false), commitMessagePromptOpen = _l[0], setCommitMessagePromptOpen = _l[1];
    var _m = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false), showCommitMessageIsRequiredError = _m[0], setShowCommitMessageIsRequiredError = _m[1];
    var commitFormRecord = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(new _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_1__.QRecord({ values: { commitMessage: valuesFromProps.defaultCommitMessage } }))[0];
    var _o = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(false), areYouSureYouWantToCancelModalOpen = _o[0], setAreYouSureYouWantToCancelModalOpen = _o[1];
    var _p = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)([]), alerts = _p[0], setAlerts = _p[1];
    var _q = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null), preSaveErrorAlertId = _q[0], setPreSaveErrorAlertId = _q[1];
    var _r = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)(null), postSaveAlertId = _r[0], setPostSaveAlertId = _r[1];
    var _s = (0,react__WEBPACK_IMPORTED_MODULE_3__.useState)({ activeTab: "editor", testRuns: [], workflowTestScenarioId: null }), rootEditorModel = _s[0], setRootEditorModel = _s[1];
    var swdRef = (0,react__WEBPACK_IMPORTED_MODULE_3__.useRef)();
    (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(function () {
        var _a;
        var lastSavedAt = localStorage.getItem("lastSavedAt");
        if (lastSavedAt) {
            localStorage.removeItem("lastSavedAt");
            ///////////////////////////////////////////////////////////////////////////
            // if the last save was < 5 seconds ago, show an alert about it          //
            // (e.g., we can be reasonably sure the page just reloaded after a save) //
            ///////////////////////////////////////////////////////////////////////////
            if (Number(lastSavedAt) + 5000 > new Date().getTime()) {
                var message = (_a = localStorage.getItem("lastSavedMessage")) !== null && _a !== void 0 ? _a : "Saved new Workflow Revision";
                openAlert(message, "success", true, true);
            }
        }
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var loadingAlertId, getWorkflowRevisionResult, _a, workflow, workflowRevision, getTypeDefinitionProcessResult, typeDefinitionValues, _b, workflowType, workflowStepTypes;
            var _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        loadingAlertId = openAlert("Loading...", "info", false, false);
                        if (!workflowRevisionId) return [3 /*break*/, 2];
                        return [4 /*yield*/, ((_c = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.qController) === null || _c === void 0 ? void 0 : _c.processRun("getWorkflowRevision", "workflowRevisionId=" + encodeURIComponent(workflowRevisionId), undefined, true))];
                    case 1:
                        getWorkflowRevisionResult = _f.sent();
                        return [3 /*break*/, 4];
                    case 2:
                        if (!workflowId) return [3 /*break*/, 4];
                        return [4 /*yield*/, ((_d = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.qController) === null || _d === void 0 ? void 0 : _d.processRun("getWorkflowRevision", "workflowId=" + encodeURIComponent(workflowId), undefined, true))];
                    case 3:
                        getWorkflowRevisionResult = _f.sent();
                        _f.label = 4;
                    case 4:
                        _a = _ModelProcessor__WEBPACK_IMPORTED_MODULE_7__["default"].convertProcessValuesToWorkflowModels(getWorkflowRevisionResult.values), workflow = _a.workflow, workflowRevision = _a.workflowRevision;
                        setWorkflow(workflow);
                        if (workflowRevision) {
                            setWorkflowRevision(workflowRevision);
                        }
                        else {
                            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                            // if there isn't yet a revision, put an empty object in state, so we can set props on it (e.g., apiName, apiVersion), so those can be seen in e.g., StepEditor //
                            //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                            //@ts-ignore - allow props to be missing.
                            workflowRevision = {};
                            setWorkflowRevision(workflowRevision);
                        }
                        return [4 /*yield*/, ((_e = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.qController) === null || _e === void 0 ? void 0 : _e.processRun("getWorkflowTypeDefinition", "workflowId=" + workflow.id, undefined, true))];
                    case 5:
                        getTypeDefinitionProcessResult = _f.sent();
                        typeDefinitionValues = getTypeDefinitionProcessResult.values;
                        _b = _ModelProcessor__WEBPACK_IMPORTED_MODULE_7__["default"].convertProcessValuesToWorkflowTypeModel(typeDefinitionValues), workflowType = _b.workflowType, workflowStepTypes = _b.workflowStepTypes;
                        setWorkflowType(workflowType);
                        setWorkflowStepTypes(workflowStepTypes);
                        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                        // for new workflows (e.g., with no revision id), allow a default api name & version to come from the type-definition lookup //
                        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                        if (!workflowRevision.id) {
                            if (typeDefinitionValues === null || typeDefinitionValues === void 0 ? void 0 : typeDefinitionValues.defaultApiName) {
                                workflowRevision.apiName = typeDefinitionValues.defaultApiName;
                            }
                            if (typeDefinitionValues === null || typeDefinitionValues === void 0 ? void 0 : typeDefinitionValues.defaultApiVersion) {
                                workflowRevision.apiVersion = typeDefinitionValues.defaultApiVersion;
                            }
                        }
                        closeAlert(loadingAlertId);
                        setReady(true);
                        return [2 /*return*/];
                }
            });
        }); })();
    }, []);
    /***************************************************************************
     *
     ***************************************************************************/
    var handleCommitDialogKeyPress = function (event) {
        if (event.key === "Enter") {
            commitMessageOKClicked();
        }
    };
    /////////////////////////////////////////////////////////////////////////////////////
    // bind handleCommitDialogKeyPress to body, when the commit message prompt is open //
    /////////////////////////////////////////////////////////////////////////////////////
    (0,react__WEBPACK_IMPORTED_MODULE_3__.useEffect)(function () {
        if (commitMessagePromptOpen) {
            document.body.addEventListener("keypress", handleCommitDialogKeyPress);
        }
        else {
            document.body.removeEventListener("keypress", handleCommitDialogKeyPress);
        }
        /////////////
        // cleanup //
        /////////////
        return function () {
            document.body.removeEventListener("keypress", handleCommitDialogKeyPress);
        };
    }, [commitMessagePromptOpen]);
    if (!ready) {
        return react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", null, "Loading...");
    }
    /***************************************************************************
     *
     ***************************************************************************/
    function editButtonClicked() {
        setIsReadonly(false);
        setIsMaximized(true);
        updateSwdController();
        setAlerts([]);
    }
    /***************************************************************************
     *
     ***************************************************************************/
    function updateSwdController() {
        if (swdRef === null || swdRef === void 0 ? void 0 : swdRef.current) {
            // @ts-ignore ...
            var controller_1 = swdRef === null || swdRef === void 0 ? void 0 : swdRef.current.getController();
            if (controller_1) {
                if (controller_1.isReady()) {
                    controller_1.updateRootComponent();
                    setTimeout(function () {
                        if (controller_1.isReady()) {
                            controller_1.updateLayout();
                        }
                        else {
                            setTimeout(updateSwdController, 100);
                        }
                    });
                }
                else {
                    setTimeout(updateSwdController, 100);
                }
            }
        }
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function openAlert(text, type, mayTimeout, mayClose) {
        var id = alertId++;
        alerts.push({ id: id, text: text, type: type, mayClose: mayClose });
        if (mayTimeout) {
            setTimeout(function () { return closeAlert(id); }, 3000);
        }
        setAlerts(__spreadArray([], alerts, true));
        return (id);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function closeAlert(id) {
        if (id == null) {
            return;
        }
        for (var i = 0; i < alerts.length; i++) {
            var alert_1 = alerts[i];
            if (alert_1.id == id) {
                alerts.splice(i, 1);
                i--;
            }
        }
        setAlerts(__spreadArray([], alerts, true));
    }
    /***************************************************************************
     * put focus in the commit message input field
     ***************************************************************************/
    function focusCommitMessageInput() {
        setTimeout(function () {
            var input = document.querySelector("input[name=\"commitMessage\"]");
            if (input) {
                //@ts-ignore
                input.select();
            }
        }, 50);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function saveClicked() {
        if (!swdRef.current) {
            console.log("SWD Ref is not set.");
            return;
        }
        // @ts-ignore .getDefinition not defined
        var definition = swdRef === null || swdRef === void 0 ? void 0 : swdRef.current.getDefinition();
        // @ts-ignore .value not defined?
        var steps = definition.value.sequence;
        closeAlert(postSaveAlertId);
        closeAlert(preSaveErrorAlertId);
        var _a = _ModelProcessor__WEBPACK_IMPORTED_MODULE_7__["default"].validateSwdDefinitionBeforeSave(steps, workflowStepTypes !== null && workflowStepTypes !== void 0 ? workflowStepTypes : {}, definition, workflowRevision), isValid = _a.isValid, error = _a.error;
        if (!isValid) {
            var alertId_1 = openAlert("Cannot save workflow:  " + (error !== null && error !== void 0 ? error : "Unspecified validation error"), "error", false, true);
            setPreSaveErrorAlertId(alertId_1);
            return;
        }
        setCommitMessagePromptOpen(true);
        setShowCommitMessageIsRequiredError(false);
        focusCommitMessageInput();
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function handleCommitFormChange(fieldName, value) {
        commitFormRecord.values.set(fieldName, value);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function onCommitModalClose() {
        setShowCommitMessageIsRequiredError(false);
        setCommitMessagePromptOpen(false);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function commitMessageCancelClicked() {
        setShowCommitMessageIsRequiredError(false);
        setCommitMessagePromptOpen(false);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function commitMessageOKClicked() {
        var commitMessage = commitFormRecord.values.get("commitMessage");
        if (valuesFromProps.isCommitMessageRequired && commitMessage.trim() == "") {
            setShowCommitMessageIsRequiredError(true);
            focusCommitMessageInput();
            return;
        }
        setCommitMessagePromptOpen(false);
        doSave(commitMessage);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function doSave(commitMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var definition, ids, steps, links, postData, value, savingAlertId, processResult, error, alertId_2, processResultValues, alertId_3, newHash, n, location_1, locationWithoutHash;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!(swdRef === null || swdRef === void 0 ? void 0 : swdRef.current)) return [3 /*break*/, 2];
                        definition = (_a = swdRef === null || swdRef === void 0 ? void 0 : swdRef.current.getDefinition()) === null || _a === void 0 ? void 0 : _a.value;
                        if (!definition) {
                            console.error("Did not get back definition from swsRef - cannot save.");
                            return [2 /*return*/];
                        }
                        setIsSaving(true);
                        updateSwdController();
                        ids = {};
                        steps = [];
                        links = [];
                        _ModelProcessor__WEBPACK_IMPORTED_MODULE_7__["default"].swdStepListToWorkflowStepsAndLinks(definition.sequence, steps, links, ids);
                        postData = new (form_data__WEBPACK_IMPORTED_MODULE_2___default())();
                        postData.append("steps", JSON.stringify(steps));
                        postData.append("links", JSON.stringify(links));
                        postData.append("apiName", definition.properties.apiName);
                        postData.append("apiVersion", definition.properties.apiVersion);
                        if (workflowId) {
                            postData.append("workflowId", workflowId);
                        }
                        if (commitMessage) {
                            postData.append("commitMessage", commitMessage);
                        }
                        if (props) {
                            value = JSON.stringify(convertMapsToObjects(props));
                            postData.append("inputProps", value);
                        }
                        closeAlert(postSaveAlertId);
                        savingAlertId = openAlert("Saving...", "info", false, false);
                        return [4 /*yield*/, ((_b = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.qController) === null || _b === void 0 ? void 0 : _b.processRun(valuesFromProps.storeNewWorkflowRevisionProcessName, postData, undefined, true))];
                    case 1:
                        processResult = _c.sent();
                        error = processResult.error;
                        if (error) {
                            setIsReadonly(false);
                            setIsSaving(false);
                            closeAlert(savingAlertId);
                            alertId_2 = openAlert("Error saving workflow: ".concat(error), "error", false, true);
                            setPostSaveAlertId(alertId_2);
                        }
                        else {
                            setIsReadonly(true);
                            setIsMaximized(false);
                            qContext === null || qContext === void 0 ? void 0 : qContext.popModalOffStack(MODAL_IDENTIFIER);
                            setIsSaving(false);
                            processResultValues = processResult.values;
                            setWorkflowId(processResultValues.workflowId);
                            closeAlert(savingAlertId);
                            alertId_3 = openAlert("Saved new Workflow Revision", "success", true, true);
                            setPostSaveAlertId(alertId_3);
                            localStorage.setItem("lastSavedAt", String(new Date().getTime()));
                            localStorage.setItem("lastSavedMessage", "Saved new Workflow Revision".concat(processResultValues.versionNo ? ": Version ".concat(processResultValues.versionNo) : ""));
                            newHash = "#reload=0";
                            if (window.location.hash.match(/^#reload=\d+$/)) {
                                n = window.location.hash.replace("#reload=", "");
                                newHash = "#reload=" + (Number(n !== null && n !== void 0 ? n : 0) + 1);
                            }
                            location_1 = "".concat(window.location);
                            locationWithoutHash = location_1.replace(/#.*/, "");
                            window.location.replace(locationWithoutHash + newHash);
                        }
                        _c.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function cancelButtonClicked() {
        var dirty = false;
        if (swdRef === null || swdRef === void 0 ? void 0 : swdRef.current) {
            // @ts-ignore ...
            dirty = swdRef === null || swdRef === void 0 ? void 0 : swdRef.current.isDirty();
        }
        if (dirty) {
            setAreYouSureYouWantToCancelModalOpen(true);
        }
        else {
            doCancel();
        }
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function onSureToCancelModalClose() {
        setAreYouSureYouWantToCancelModalOpen(false);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function doCancelCancelClicked() {
        setAreYouSureYouWantToCancelModalOpen(false);
    }
    /***************************************************************************
     **
     ***************************************************************************/
    function doCancelOKClicked() {
        setAreYouSureYouWantToCancelModalOpen(false);
        doCancel();
    }
    /***************************************************************************
     *
     ***************************************************************************/
    function doCancel() {
        setIsReadonly(true);
        setIsMaximized(false);
        qContext === null || qContext === void 0 ? void 0 : qContext.popModalOffStack(MODAL_IDENTIFIER);
        updateSwdController();
    }
    var maximizedStyle = {
        height: "100%",
        padding: "3rem",
    };
    var defaultStyle = {
        height: "100%",
    };
    /***************************************************************************
     *
     ***************************************************************************/
    function noop() {
    }
    var commitForm = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeForm([new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({ name: "commitMessage", type: "STRING", label: "Commit Message".concat(valuesFromProps.isCommitMessageRequired ? " *" : ""), gridColumns: 12, isRequired: true })], commitFormRecord, handleCommitFormChange, noop);
    var commitModalBody = react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { width: "600px", background: "white", padding: "1rem", borderRadius: "1rem", margin: "auto", marginTop: "calc(40vh)" } },
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("h3", null, "Please Enter a Commit Message"),
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { marginRight: "-1rem", marginBottom: "1rem" } },
            commitForm,
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { className: "fieldErrorMessage" },
                showCommitMessageIsRequiredError && react__WEBPACK_IMPORTED_MODULE_3___default().createElement("span", null, "Commit Message is required."),
                "\u00A0")),
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "flex", justifyContent: "flex-end" } },
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "100px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Cancel", commitMessageCancelClicked, { variant: "gradient", color: "dark" })),
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "100px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("OK", commitMessageOKClicked, { variant: "gradient", color: "info" }))));
    var sureToCancelModalBody = react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { width: "600px", background: "white", padding: "1rem", borderRadius: "1rem", margin: "auto", marginTop: "calc(40vh)" } },
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("h3", null, "Discard changes?"),
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { margin: "1rem 0" } }, "You have unsaved changes that will be lost if you leave this page."),
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "flex", justifyContent: "flex-end" } },
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "200px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Discard changes", doCancelOKClicked, { variant: "gradient", color: "dark" })),
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "200px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Continue editing", doCancelCancelClicked, { variant: "gradient", color: "info" }))));
    var body = (react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { className: "".concat(isMaximized ? "maximized" : "", " ").concat(valuesFromProps.toolboxShowHandleIcons ? "toolbox-handle-icons" : ""), style: __assign({ position: "relative" }, (isMaximized ? maximizedStyle : defaultStyle)) },
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { position: "absolute", top: "1rem", right: "1rem", zIndex: "100", display: "flex", justifyContent: "space-between" } },
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", null, valuesFromProps.readonlyState == "initially" && isReadonly && !isSaving &&
                react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "100px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Edit", editButtonClicked, { variant: "gradient", color: "dark" })))),
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { position: "absolute", top: isMaximized ? "4rem" : "1rem", zIndex: "900", display: "flex", justifyContent: "center", width: "calc(100% - 400px)", left: "200px" } },
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", null, alerts.map(function (alert, index) { return (react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { key: "".concat(alert.id, ".").concat(index), style: { paddingBottom: "0.5rem" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeAlert(alert.text, alert.type, alert.mayClose))); }))),
        react__WEBPACK_IMPORTED_MODULE_3___default().createElement(_SequentialWorkflowWrapper__WEBPACK_IMPORTED_MODULE_8__["default"], { ref: swdRef, isSwdPro: true, isReadonly: isReadonly, showIconsOnSteps: valuesFromProps.showIconsOnSteps, includeTestForm: valuesFromProps.includeTestForm, workflowType: workflowType, workflowStepTypes: workflowStepTypes, workflow: workflow, workflowRevision: workflowRevision, setWorkflowRevision: setWorkflowRevision, qfmdBridge: qfmdBridge, qContext: qContext, rootEditorModel: rootEditorModel, setRootEditorModel: setRootEditorModel, executedStepIds: valuesFromProps.executedStepIds, stepOutputMap: valuesFromProps.stepOutputMap, stepLogMessageMap: valuesFromProps.stepLogMessageMap }),
        !isReadonly && !isSaving &&
            react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { background: "white", position: "relative", bottom: "4.25rem", borderRadius: "0 0 1rem 1rem", padding: "1rem", minHeight: "2.25rem", borderTop: "1px solid black", zIndex: "30", display: "flex", flexDirection: "row-reverse", alignItems: "center" } },
                react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", null,
                    valuesFromProps.readonlyState == "initially" && !isReadonly && !isSaving &&
                        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "100px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Cancel", cancelButtonClicked, { variant: "gradient", color: "dark" })),
                    !isReadonly && !isSaving &&
                        react__WEBPACK_IMPORTED_MODULE_3___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "100px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Save", saveClicked, { variant: "gradient", color: "info" })))),
        commitMessagePromptOpen && (qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeModal(commitModalBody, onCommitModalClose, qContext)),
        areYouSureYouWantToCancelModalOpen && (qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeModal(sureToCancelModalBody, onSureToCancelModalClose, qContext))));
    function closeModal(setIsOpen, event, reason) {
        ///////////////////////////////////
        // don't close for these reasons //
        ///////////////////////////////////
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
            return;
        }
        setIsOpen(false);
    }
    if (isMaximized && qfmdBridge) {
        return (qfmdBridge.makeModal(body, closeModal, qContext, MODAL_IDENTIFIER));
    }
    else {
        return body;
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (QSequentialWorkflow);
/***************************************************************************
 **
 ***************************************************************************/
function convertMapsToObjects(obj) {
    if (obj instanceof Map) {
        var result_1 = {};
        //@ts-ignore
        obj.keys().forEach(function (key) { return result_1[key] = convertMapsToObjects(obj.get(key)); });
        return result_1;
    }
    else if (Array.isArray(obj)) {
        return obj.map(convertMapsToObjects);
    }
    else if (obj !== null && typeof obj === "object") {
        var result = {};
        for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            result[key] = convertMapsToObjects(value);
        }
        return result;
    }
    return obj;
}


/***/ },

/***/ "./src/component/RootEditor.tsx"
/*!**************************************!*\
  !*** ./src/component/RootEditor.tsx ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RootEditor: () => (/* binding */ RootEditor)
/* harmony export */ });
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData.js");
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/QRecord */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QRecord.js");
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_query_QCriteriaOperator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/query/QCriteriaOperator */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QCriteriaOperator.js");
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_query_QFilterCriteria__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/query/QFilterCriteria */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QFilterCriteria.js");
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_query_QQueryFilter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/query/QQueryFilter */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/query/QQueryFilter.js");
/* harmony import */ var form_data__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! form-data */ "./node_modules/form-data/lib/browser.js");
/* harmony import */ var form_data__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(form_data__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! sequential-workflow-designer-react */ "./node_modules/sequential-workflow-designer-react/lib/esm/index.js");
/* harmony import */ var _ModelProcessor__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./ModelProcessor */ "./src/component/ModelProcessor.ts");
/* harmony import */ var _TestRun__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./TestRun */ "./src/component/TestRun.tsx");
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};










var nextTestRunId = 1;
/***************************************************************************
 **
 ***************************************************************************/
function RootEditor(_a) {
    var _b, _c;
    var qfmdBridge = _a.qfmdBridge, workflowType = _a.workflowType, workflowRevision = _a.workflowRevision, setWorkflowRevision = _a.setWorkflowRevision, includeTestForm = _a.includeTestForm, workflow = _a.workflow, definition = _a.definition, controller = _a.controller, rootEditorModel = _a.rootEditorModel, setRootEditorModel = _a.setRootEditorModel, setDefinition = _a.setDefinition;
    var _d = (0,sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_7__.useRootEditor)(), properties = _d.properties, setProperty = _d.setProperty;
    var _e = (0,react__WEBPACK_IMPORTED_MODULE_6__.useState)(false), isATestRunning = _e[0], setIsATestRunning = _e[1];
    var _f = (0,react__WEBPACK_IMPORTED_MODULE_6__.useState)(rootEditorModel), localRootEditorModel = _f[0], setLocalRootEditorModel = _f[1];
    var _g = (0,react__WEBPACK_IMPORTED_MODULE_6__.useState)(rootEditorModel.workflowTestScenarioId), workflowTestScenarioId = _g[0], setWorkflowTestScenarioId = _g[1];
    var _h = (0,react__WEBPACK_IMPORTED_MODULE_6__.useReducer)(function (x) { return x + 1; }, 0), forceUpdate = _h[1];
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // Backend delivers a plain object for help content (not a Map). Support both `helpContent` and `helpContents`. //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    var helpContentDict = ((_c = (_b = workflowType === null || workflowType === void 0 ? void 0 : workflowType.helpContent) !== null && _b !== void 0 ? _b : workflowType === null || workflowType === void 0 ? void 0 : workflowType.helpContents) !== null && _c !== void 0 ? _c : {});
    var hc = function (key) {
        var v = helpContentDict[key];
        if (!v) {
            return [];
        }
        if (Array.isArray(v)) {
            return v;
        }
        if (typeof v === "object") {
            return [v];
        }
        // primitive fallback
        return [{ content: String(v) }];
    };
    var fields = [
        new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({
            name: "workflowName",
            label: "Workflow Name",
            type: "STRING",
            gridColumns: 12,
            isEditable: false,
            helpContents: hc("workflow:editor;field:workflowName")
        }),
        new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({
            name: "versionNo",
            label: "Version No",
            type: "INTEGER",
            gridColumns: 12,
            isEditable: false,
            helpContents: hc("workflow:editor;field:versionNo")
        }),
        new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({
            name: "apiName",
            label: "API Name",
            type: "STRING",
            gridColumns: 12,
            isEditable: true,
            isRequired: true,
            possibleValueSourceName: "apiName",
            helpContents: hc("workflow:editor;field:apiName")
        }),
        new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({
            name: "apiVersion",
            label: "API Version",
            type: "STRING",
            gridColumns: 12,
            isEditable: true,
            isRequired: true,
            possibleValueSourceName: "apiVersion",
            helpContents: hc("workflow:editor;field:apiVersion")
        }),
    ];
    var testFields = [
        new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({
            name: "workflowTestScenarioId",
            label: "Test Scenario",
            type: "INTEGER",
            gridColumns: 12,
            isEditable: true,
            possibleValueSourceName: "workflowTestScenario",
            possibleValueSourceFilter: new _qrunio_qqq_frontend_core_lib_model_query_QQueryFilter__WEBPACK_IMPORTED_MODULE_4__.QQueryFilter([new _qrunio_qqq_frontend_core_lib_model_query_QFilterCriteria__WEBPACK_IMPORTED_MODULE_3__.QFilterCriteria("workflowId", _qrunio_qqq_frontend_core_lib_model_query_QCriteriaOperator__WEBPACK_IMPORTED_MODULE_2__.QCriteriaOperator.EQUALS, [workflow === null || workflow === void 0 ? void 0 : workflow.id])]),
            helpContents: hc("workflow:tester;field:workflowTestScenarioId")
        }),
    ];
    var record = new _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_1__.QRecord({ values: properties });
    record.values.set("workflowTestScenarioId", workflowTestScenarioId);
    /***************************************************************************
     *
     ***************************************************************************/
    function noop() {
    }
    /***************************************************************************
     *
     ***************************************************************************/
    var handleWorkflowChange = function (fieldName, value) {
        setProperty(fieldName, value);
        if (workflowRevision) {
            if (fieldName == "apiName") {
                workflowRevision.apiName = value;
                setWorkflowRevision(JSON.parse(JSON.stringify(workflowRevision)));
            }
            else if (fieldName == "apiVersion") {
                workflowRevision.apiVersion = value;
                setWorkflowRevision(JSON.parse(JSON.stringify(workflowRevision)));
            }
        }
    };
    /***************************************************************************
     *
     ***************************************************************************/
    var handleTestScenarioChange = function (fieldName, value) {
        setWorkflowTestScenarioId(value);
        setRootEditorModel(__assign(__assign({}, rootEditorModel), { workflowTestScenarioId: value }));
    };
    /***************************************************************************
     *
     ***************************************************************************/
    function runTest() {
        var _a;
        if (!definition) {
            alert("Workflow definition not found - cannot test.");
            return;
        }
        // todo some validation before trying to run
        var ids = {};
        var steps = [];
        var links = [];
        _ModelProcessor__WEBPACK_IMPORTED_MODULE_8__["default"].swdStepListToWorkflowStepsAndLinks(definition.value.sequence, steps, links, ids);
        var formData = new (form_data__WEBPACK_IMPORTED_MODULE_5___default())();
        formData.append("steps", JSON.stringify(steps));
        formData.append("links", JSON.stringify(links));
        formData.append("apiName", definition.value.properties.apiName);
        formData.append("apiVersion", definition.value.properties.apiVersion);
        if (workflow === null || workflow === void 0 ? void 0 : workflow.id) {
            formData.append("workflowId", workflow === null || workflow === void 0 ? void 0 : workflow.id);
        }
        if (workflowTestScenarioId) {
            formData.append("workflowTestScenarioId", workflowTestScenarioId);
        }
        var newTestRun = { id: nextTestRunId++, state: "running", timestamp: new Date(), workflowTestScenarioId: workflowTestScenarioId };
        var newRootEditorModel = __assign(__assign({}, rootEditorModel), { testRuns: __spreadArray([newTestRun], localRootEditorModel.testRuns, true) });
        setRootEditorModel(newRootEditorModel);
        setLocalRootEditorModel(newRootEditorModel);
        setIsATestRunning(true);
        (_a = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.qController) === null || _a === void 0 ? void 0 : _a.processRun("testWorkflowInEditor", formData, undefined, true).then(function (processResult) {
            setIsATestRunning(false);
            var error = processResult.error;
            if (error) {
                newTestRun.state = "incomplete";
                newTestRun.errorMessage = error;
                forceUpdate();
            }
            else {
                var processResultValues = processResult.values;
                newTestRun.state = "complete";
                newTestRun.values = processResultValues;
                // todo would need stepNo and all the other things for this...
                // for (let step of definition.value.sequence)
                // {
                //    step.properties.isTraced = true;
                // }
                // setDefinition?.(definition);
                forceUpdate();
            }
        }).catch(function (error) {
            setIsATestRunning(false);
            newTestRun.state = "incomplete";
            newTestRun.errorMessage = error.message;
            forceUpdate();
        });
    }
    /***************************************************************************
     *
     ***************************************************************************/
    function activateTab(tabName) {
        rootEditorModel.activeTab = tabName;
        setRootEditorModel(rootEditorModel);
        forceUpdate();
    }
    return (react__WEBPACK_IMPORTED_MODULE_6___default().createElement((react__WEBPACK_IMPORTED_MODULE_6___default().Fragment), null,
        react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "tabsBar" },
            react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "tab ".concat(rootEditorModel.activeTab == "editor" ? "active" : ""), onClick: function () { return activateTab("editor"); } }, "Editor"),
            includeTestForm && react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "tab ".concat(rootEditorModel.activeTab == "tester" ? "active" : ""), onClick: function () { return activateTab("tester"); } }, "Tester")),
        react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "tabsContainer" },
            rootEditorModel.activeTab === "editor" &&
                react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "tabPanel" },
                    react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { style: { width: "100%" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeForm(fields, record, handleWorkflowChange, noop, ["ALL_SCREENS"], "workflow:editor;"))),
            rootEditorModel.activeTab === "tester" && includeTestForm &&
                react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "tabPanel testForm" },
                    react__WEBPACK_IMPORTED_MODULE_6___default().createElement("h2", null, "Workflow Tester"), qfmdBridge === null || qfmdBridge === void 0 ? void 0 :
                    qfmdBridge.makeForm(testFields, record, handleTestScenarioChange, noop, ["ALL_SCREENS"], "workflow:tester;"),
                    react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "scenarioButtons" },
                        react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", null, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Run Test", runTest, { disabled: isATestRunning, variant: "gradient", color: "light" }))),
                    react__WEBPACK_IMPORTED_MODULE_6___default().createElement("h3", null, "Test Results"),
                    react__WEBPACK_IMPORTED_MODULE_6___default().createElement("div", { className: "resultsContainer" },
                        react__WEBPACK_IMPORTED_MODULE_6___default().createElement("ul", null, localRootEditorModel.testRuns.map(function (testRun, index) { return react__WEBPACK_IMPORTED_MODULE_6___default().createElement(_TestRun__WEBPACK_IMPORTED_MODULE_9__.TestRunView, { qfmdBridge: qfmdBridge, key: "testRun-".concat(testRun.id), testRun: testRun }); })))))));
}


/***/ },

/***/ "./src/component/SequentialWorkflowWrapper.tsx"
/*!*****************************************************!*\
  !*** ./src/component/SequentialWorkflowWrapper.tsx ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _WorkflowDesignerExtensions__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./WorkflowDesignerExtensions */ "./src/component/WorkflowDesignerExtensions.ts");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! sequential-workflow-designer */ "./node_modules/sequential-workflow-designer/lib/esm/index.js");
/* harmony import */ var sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sequential-workflow-designer-react */ "./node_modules/sequential-workflow-designer-react/lib/esm/index.js");
/* harmony import */ var _ModelProcessor__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ModelProcessor */ "./src/component/ModelProcessor.ts");
/* harmony import */ var _RootEditor__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./RootEditor */ "./src/component/RootEditor.tsx");
/* harmony import */ var _StepComponentViewWrapper__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./StepComponentViewWrapper */ "./src/component/StepComponentViewWrapper.tsx");
/* harmony import */ var _StepEditor__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./StepEditor */ "./src/component/StepEditor.tsx");
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};








var maxStepNo = 0;
/***************************************************************************
 *
 ***************************************************************************/
function setMaxStepNo(sequence) {
    var _a;
    function localMax(qswdStepNo, maxStepNo) {
        if (qswdStepNo && typeof qswdStepNo == "number" && qswdStepNo > maxStepNo) {
            return qswdStepNo;
        }
        return maxStepNo;
    }
    for (var _i = 0, sequence_1 = sequence; _i < sequence_1.length; _i++) {
        var step = sequence_1[_i];
        maxStepNo = localMax((_a = step === null || step === void 0 ? void 0 : step.properties) === null || _a === void 0 ? void 0 : _a.qswdStepNo, maxStepNo);
        var branches = step.branches;
        if (branches) {
            for (var key in branches) {
                setMaxStepNo(branches[key]);
            }
        }
        var subSequence = step.sequence;
        if (subSequence) {
            setMaxStepNo(subSequence);
        }
    }
}
/***************************************************************************
 **
 ***************************************************************************/
var SequentialWorkflowWrapper = (0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)(function (_a, ref) {
    var workflowType = _a.workflowType, workflowStepTypes = _a.workflowStepTypes, qfmdBridge = _a.qfmdBridge, qContext = _a.qContext, workflow = _a.workflow, workflowRevision = _a.workflowRevision, isReadonly = _a.isReadonly, isSwdPro = _a.isSwdPro, showIconsOnSteps = _a.showIconsOnSteps, includeTestForm = _a.includeTestForm, setWorkflowRevision = _a.setWorkflowRevision, executedStepIds = _a.executedStepIds, stepOutputMap = _a.stepOutputMap, stepLogMessageMap = _a.stepLogMessageMap, rootEditorModel = _a.rootEditorModel, setRootEditorModel = _a.setRootEditorModel;
    var definitionWalker = new sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_2__.DefinitionWalker();
    /***************************************************************************
     **
     ***************************************************************************/
    function definitionToJsonString(definition) {
        var ids = {};
        var steps = [];
        var links = [];
        _ModelProcessor__WEBPACK_IMPORTED_MODULE_4__["default"].swdStepListToWorkflowStepsAndLinks(definition.sequence, steps, links, ids);
        return JSON.stringify({ steps: steps, links: links });
    }
    ///////////////////////////////////
    // setup for sequential workflow //
    ///////////////////////////////////
    var initialDefinition = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(function () { return _ModelProcessor__WEBPACK_IMPORTED_MODULE_4__["default"].workflowRevisionToSwdDefinition(workflow, workflowRevision, workflowStepTypes, executedStepIds, stepOutputMap, stepLogMessageMap, isSwdPro); }, []);
    (0,react__WEBPACK_IMPORTED_MODULE_1__.useEffect)(function () {
        maxStepNo = 0;
        setMaxStepNo(initialDefinition.sequence);
    }, []);
    var initialDefinitionJson = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(definitionToJsonString(initialDefinition))[0];
    var _b = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(null), selectedStepId = _b[0], setSelectedStepId = _b[1];
    var _c = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({}), alreadyProcessedSteps = _c[0], setAlreadyProcessedSteps = _c[1];
    var controller = (0,sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_3__.useSequentialWorkflowDesignerController)();
    var toolboxConfiguration = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(function (workflowStepType) {
        var _a;
        var groups = [];
        for (var _i = 0, _b = (_a = workflowType === null || workflowType === void 0 ? void 0 : workflowType.stepTypeCategories) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
            var category = _b[_i];
            var steps = [];
            for (var _c = 0, _d = category.workflowStepTypes; _c < _d.length; _c++) {
                var workflowStepTypeName = _d[_c];
                var workflowStepType_1 = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[workflowStepTypeName];
                if (workflowStepType_1) {
                    steps.push(_ModelProcessor__WEBPACK_IMPORTED_MODULE_4__["default"].createWorkflowStep(workflowStepType_1, null, isSwdPro));
                }
            }
            groups.push({ name: category.label, steps: steps });
        }
        return ({ groups: groups });
    }, []);
    var stepsConfiguration = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(function () { return ({
        iconUrlProvider: function (componentType, type) {
            var _a, _b;
            return ((_b = (_a = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[type]) === null || _a === void 0 ? void 0 : _a.iconUrl) !== null && _b !== void 0 ? _b : null);
        },
        isSelectable: function (boolean) {
            return (!isReadonly);
        },
    }); }, []);
    var validatorConfiguration = (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(function () { return ({
        step: function (step) { return _ModelProcessor__WEBPACK_IMPORTED_MODULE_4__["default"].validateSwdStep(step, workflowStepTypes !== null && workflowStepTypes !== void 0 ? workflowStepTypes : {}); },
        root: function (definition) { return _ModelProcessor__WEBPACK_IMPORTED_MODULE_4__["default"].validateDefinition(definition, workflowRevision); },
    }); }, []);
    var _d = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false), isToolboxCollapsed = _d[0], setIsToolboxCollapsed = _d[1];
    var _e = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(function () { return (0,sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_3__.wrapDefinition)(initialDefinition); }), definition = _e[0], setDefinition = _e[1];
    //////////////////////////////////////////////////////////
    // Handle definition changes and expand composite steps //
    //////////////////////////////////////////////////////////
    var handleDefinitionChange = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(function (newDefinition) {
        processStepsForDefinitionChange(newDefinition.value);
        setDefinition(newDefinition);
    }, []);
    /***************************************************************************
     * Function to expand composite steps when they're added, also deal with
     * stepNos
     *
     * Seems pretty important not to replace the definition object or the
     * sequence within it - but we can at least do some manipulations to
     * steps in the sequence.
     ***************************************************************************/
    function processStepsForDefinitionChange(definition) {
        //////////////////////////////////////////////
        // helper function to process a single step //
        //////////////////////////////////////////////
        var processStep = function (step) {
            var _a;
            /////////////////////////////////////////////////////
            // avoid ever processing a step more than one time //
            /////////////////////////////////////////////////////
            if (!alreadyProcessedSteps[step.id]) {
                alreadyProcessedSteps[step.id] = true;
                setAlreadyProcessedSteps(__assign({}, alreadyProcessedSteps));
                if (step.properties.qswdStepNo) {
                    ///////////////////////////////////////////////////////////////
                    // take this to mean the step was previously in the workflow //
                    // e.g., from initial load - so do not expand now.           //
                    ///////////////////////////////////////////////////////////////
                    return (step);
                }
                step.properties.qswdStepNo = ++maxStepNo;
                step.name = "".concat(step.properties.qswdStepNo, ": ").concat(step.name);
                var stepType = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[step.type];
                if ("branches" in step) {
                    var _loop_1 = function (option) {
                        if (option.stepTypesToIncludeByDefault) {
                            option.stepTypesToIncludeByDefault.forEach(function (subStepName) {
                                var workflowStepType = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[subStepName];
                                if (workflowStepType) {
                                    var subStep = _ModelProcessor__WEBPACK_IMPORTED_MODULE_4__["default"].createWorkflowStep(workflowStepType, null, isSwdPro);
                                    step.branches[option.value].push(subStep);
                                }
                                else {
                                    console.log("Unrecognized step type: " + subStepName);
                                }
                            });
                        }
                    };
                    for (var _i = 0, _b = ((_a = stepType === null || stepType === void 0 ? void 0 : stepType.outboundLinkOptions) !== null && _a !== void 0 ? _a : []); _i < _b.length; _i++) {
                        var option = _b[_i];
                        _loop_1(option);
                    }
                }
            }
            ///////////////////////////////////////////////
            // recursively process branches & containers //
            ///////////////////////////////////////////////
            var expandedStep = __assign({}, step);
            if ("branches" in step && step.branches) {
                var branches = expandedStep.branches;
                for (var key in branches) {
                    for (var _c = 0, _d = branches[key]; _c < _d.length; _c++) {
                        var subStep = _d[_c];
                        processStep(subStep);
                    }
                }
            }
            if ("sequence" in step && step.sequence) {
                var subSequence = expandedStep.sequence;
                for (var _e = 0, subSequence_1 = subSequence; _e < subSequence_1.length; _e++) {
                    var subStep = subSequence_1[_e];
                    processStep(subStep);
                }
            }
            return (step);
        };
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // walk over the steps in the definition - processing any of them that haven't previously been (e.g., new ones!) //
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        for (var _i = 0, _a = definition.sequence; _i < _a.length; _i++) {
            var step = _a[_i];
            processStep(step);
        }
    }
    ;(0,react__WEBPACK_IMPORTED_MODULE_1__.useImperativeHandle)(ref, function () { return ({
        getController: function () { return controller; },
        getDefinition: function () { return definition; },
        isDirty: function () {
            var currentDefinitionJson = definitionToJsonString(definition.value);
            return (currentDefinitionJson != initialDefinitionJson);
        }
    }); });
    /***************************************************************************
     **
     ***************************************************************************/
    function canCreatePlaceholder(sequence, index) {
        var _a;
        if (index > 0 && ((_a = sequence[index - 1]) === null || _a === void 0 ? void 0 : _a.componentType) === "interruptingTask") {
            return false;
        }
        return true;
    }
    /***************************************************************************
     *
     ***************************************************************************/
    function canShowPlaceholder(sequence, index, draggingStepComponentType, draggingStepType, definition) {
        if (!workflowStepTypes) {
            ////////////////////////////////////////////////////////////////
            // if we don't know the step types, return early allowing all //
            ////////////////////////////////////////////////////////////////
            return (true);
        }
        ////////////////////////////////////////////////////////////////////////////////////////////
        // at this time we only care about parent/child/ancestor/descendant type relationships    //
        // which means we don't are about the index param (which is which spot within a sequence) //
        // rather, we only care about the parents of the sequence itself                          //
        ////////////////////////////////////////////////////////////////////////////////////////////
        var parents = definitionWalker.getParents(definition, sequence);
        var parentTypes = parents.filter(function (p) { return typeof p === "object"; }).map(function (p) { return p.type; });
        for (var _i = 0, parentTypes_1 = parentTypes; _i < parentTypes_1.length; _i++) {
            var typeName = parentTypes_1[_i];
            var targetStepType = workflowStepTypes[typeName];
            ////////////////////////////////////////////////////////////////////////////////////////
            // if this ancestor defines a restricted list of allowed descendants, then make sure  //
            // the step type being dragged in here is in that list - if it isn't, then reject it. //
            ////////////////////////////////////////////////////////////////////////////////////////
            if (targetStepType === null || targetStepType === void 0 ? void 0 : targetStepType.allowedDescendantStepTypes) {
                if ((targetStepType === null || targetStepType === void 0 ? void 0 : targetStepType.allowedDescendantStepTypes.indexOf(draggingStepType)) == -1) {
                    return (false);
                }
            }
        }
        //////////////////////////////////////////////////////
        // if we didn't find a reason to reject, then allow //
        //////////////////////////////////////////////////////
        return (true);
    }
    var extensions = isSwdPro ? (0,react__WEBPACK_IMPORTED_MODULE_1__.useMemo)(function () { return [
        (0,_WorkflowDesignerExtensions__WEBPACK_IMPORTED_MODULE_0__.createWorkflowDesignerExtensions)(new _StepComponentViewWrapper__WEBPACK_IMPORTED_MODULE_6__.StepComponentViewWrapper(isReadonly, workflowStepTypes !== null && workflowStepTypes !== void 0 ? workflowStepTypes : {}, showIconsOnSteps)),
        sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_2__.StepsDesignerExtension.create({
            container: {
                view: {
                    isRegionClickable: true,
                    paddingTop: 0,
                    paddingX: 40,
                    inputSize: 48,
                    inputRadius: 24,
                    inputIconSize: 32,
                    autoHideInputOnDrag: false,
                    label: {
                        minWidth: 240,
                        height: 40,
                        paddingX: 20,
                        radius: 8
                    }
                }
            },
            switch: {
                branchNamesResolver: function (step) { return step.properties.branchNames || Object.keys(step.branches); },
                view: {
                    minBranchWidth: 1,
                    noBranchPaddingBottom: 0,
                    isRegionClickable: true,
                    paddingX: 40,
                    paddingTop1: 0,
                    paddingTop2: 20,
                    connectionHeight: 40,
                    inputSize: 48, // the circle with the icon in it
                    inputRadius: 24, // border-radius for the shape with the icon
                    inputIconSize: 32,
                    autoHideInputOnDrag: false,
                    nameLabel: {
                        minWidth: 240,
                        height: 72,
                        paddingX: 20,
                        radius: 8
                    },
                    branchNameLabel: {
                        minWidth: 50,
                        height: 40,
                        paddingX: 20,
                        radius: 8
                    }
                }
            }
        }),
    ]; }, [isReadonly, selectedStepId]) : [];
    /***************************************************************************
     **
     ***************************************************************************/
    function onSelectedStepIdChanged(newValue) {
        var oldRect = document.querySelector("[data-qswdId=\"".concat(selectedStepId, "\"]>rect"));
        if (oldRect) {
            //@ts-ignore .baseVal...
            oldRect.setAttribute("class", oldRect.className.baseVal.replace("sqd-selected", ""));
        }
        setSelectedStepId(newValue);
        // setTimeout(() => controller.updateRootComponent());
        var switchRect = document.querySelector("[data-qswdId=\"".concat(newValue, "\"]>rect"));
        if (switchRect) {
            //@ts-ignore .baseVal...
            switchRect.setAttribute("class", "".concat(switchRect.className.baseVal, " sqd-selected"));
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // todo - move this out of (above) here - as if this was ever true, then became false, we'd have diff number of hooks, thus error. //
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    if (!workflowType || !workflowStepTypes) {
        return (react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null, "Workflow definition not available..."));
    }
    return (react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", { className: "qSequentialWorkflow ".concat(isReadonly ? "readonly" : "") },
        react__WEBPACK_IMPORTED_MODULE_1___default().createElement(sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_3__.SequentialWorkflowDesigner, { extensions: extensions, undoStackSize: 20, definition: definition, onDefinitionChange: handleDefinitionChange, isReadonly: isReadonly, toolboxConfiguration: toolboxConfiguration, isToolboxCollapsed: isToolboxCollapsed, onIsToolboxCollapsedChanged: setIsToolboxCollapsed, stepsConfiguration: stepsConfiguration, validatorConfiguration: validatorConfiguration, controlBar: true, rootEditor: react__WEBPACK_IMPORTED_MODULE_1___default().createElement(_RootEditor__WEBPACK_IMPORTED_MODULE_5__.RootEditor, { workflowType: workflowType, definition: definition, setDefinition: setDefinition, controller: controller, rootEditorModel: rootEditorModel, setRootEditorModel: setRootEditorModel, qfmdBridge: qfmdBridge, workflow: workflow, workflowRevision: workflowRevision, setWorkflowRevision: setWorkflowRevision, includeTestForm: includeTestForm }), stepEditor: react__WEBPACK_IMPORTED_MODULE_1___default().createElement(_StepEditor__WEBPACK_IMPORTED_MODULE_7__.StepEditor, { workflowType: workflowType, workflowStepTypes: workflowStepTypes, workflow: workflow, workflowRevision: workflowRevision, qfmdBridge: qfmdBridge, qContext: qContext, controller: controller }), controller: controller, selectedStepId: selectedStepId, onSelectedStepIdChanged: onSelectedStepIdChanged, placeholderConfiguration: { canCreate: canCreatePlaceholder, canShow: canShowPlaceholder } })));
});
SequentialWorkflowWrapper.defaultProps =
    {
        isReadonly: false,
        showIconsOnSteps: true,
        isSwdPro: false
    };
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (SequentialWorkflowWrapper);


/***/ },

/***/ "./src/component/StepComponentViewWrapper.tsx"
/*!****************************************************!*\
  !*** ./src/component/StepComponentViewWrapper.tsx ***!
  \****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   StepComponentViewWrapper: () => (/* binding */ StepComponentViewWrapper)
/* harmony export */ });
/* harmony import */ var sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sequential-workflow-designer */ "./node_modules/sequential-workflow-designer/lib/esm/index.js");

/***************************************************************************
 ** Customize the SVG generated for a step before it is rendered
 ***************************************************************************/
var StepComponentViewWrapper = /** @class */ (function () {
    /***************************************************************************
     **
     ***************************************************************************/
    function StepComponentViewWrapper(isReadonly, workflowStepTypes, showIcons) {
        this.isReadonly = !!isReadonly;
        this.workflowStepTypes = workflowStepTypes;
        this.showIcons = !!showIcons;
    }
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.wrap = function (view, stepContext) {
        var _a;
        if (stepContext.step.componentType == "switch") {
            this.processSwitch(view, stepContext);
        }
        if (stepContext.step.componentType == "container") {
            this.processContainer(view, stepContext);
        }
        else if (stepContext.step.componentType == "largeTask") {
            this.processLargeTask(view, stepContext);
        }
        else if (stepContext.step.componentType == "interruptingTask") {
            this.processInterruptingTask(view, stepContext);
        }
        var svg = this.findAncestorWithNodeName(view.g, "svg");
        if (svg) {
            var defs = svg.children.item(0);
            if (defs && defs.children.length < 2) {
                var pattern = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("pattern");
                pattern.setAttribute("id", "readonly-background-pattern");
                pattern.setAttribute("patternUnits", "userSpaceOnUse");
                pattern.setAttribute("width", "10");
                pattern.setAttribute("height", "10");
                pattern.setAttribute("patternTransform", "rotate(45)");
                var line = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("line");
                line.setAttribute("x1", "0");
                line.setAttribute("y1", "0");
                line.setAttribute("x2", "0");
                line.setAttribute("y2", "10");
                line.setAttribute("stroke", "#F0F0F0");
                line.setAttribute("stroke-width", "8");
                pattern.appendChild(line);
                defs === null || defs === void 0 ? void 0 : defs.appendChild(pattern);
                var fillPattern = this.isReadonly ? "readonly-background-pattern" : (_a = defs.children.item(0)) === null || _a === void 0 ? void 0 : _a.id;
                var backgroundRect = svg.children.item(1);
                if (backgroundRect) {
                    backgroundRect.setAttribute("fill", "url(#".concat(fillPattern, ")"));
                }
            }
        }
        /* todo trying to add click-to-add-step function
        if(!this.isReadonly)
        {
           setTimeout(() => document.querySelectorAll(".sqd-placeholder").forEach(e =>
           {
              e.removeEventListener('click', this.placeholderClick)
              e.addEventListener('click', this.placeholderClick);
           }));
        }
        */
        if (stepContext.step.componentType == "largeTask" || stepContext.step.componentType == "interruptingTask") {
            // The task factory's rectangle was replaced above. Focus must use the
            // connected application rectangle rather than the detached original.
            view.getClientPosition = function () { var _a; return (0,sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.getAbsolutePosition)((_a = view.g.querySelector(".sqd-large-task-rect")) !== null && _a !== void 0 ? _a : view.g); };
        }
        return view;
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.placeholderClick = function (e) {
        var target = e.target;
        console.log("".concat(target.getAttribute("underStepNo")));
        e.stopPropagation();
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.findAncestorWithNodeName = function (g, nodeName) {
        var e = g;
        do {
            if (e.nodeName == nodeName) {
                return (e);
            }
            e = e.parentElement;
        } while (e);
        return (null);
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.getDownArrowPolygonPoints = function () {
        var width = 14;
        var height = 11;
        return ("0,0 -".concat(width / 2, ",-").concat(height, " ").concat(width / 2, ",-").concat(height));
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.getClassName = function (child) {
        var className = "";
        try {
            //@ts-ignore
            className = child === null || child === void 0 ? void 0 : child.className.baseVal;
        }
        catch (e) {
            // leave empty
        }
        return className;
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processSwitch = function (view, stepContext) {
        var _this = this;
        var _a, _b;
        if (view.g.classList.contains("sqd-collapsed")) {
            this.processCollapsedSwitch(view, stepContext);
            return;
        }
        ///////////////////////////////
        // process the branch labels //
        ///////////////////////////////
        var branchLabels = view.g.querySelectorAll(":scope > g.sqd-label-secondary");
        branchLabels.forEach(function (branch) {
            var _a;
            _this.processBranchLabel(branch, stepContext, String((_a = stepContext.step.properties.output) !== null && _a !== void 0 ? _a : ""));
        });
        ///////////////////////////////////////////////////////////////
        // remove children that the replacement method will generate //
        // - but not the child steps or lines or container box       //
        ///////////////////////////////////////////////////////////////
        var xOffset = 0;
        var originalRectangleHeight = 0;
        for (var i = 0; i < view.g.children.length; i++) {
            var removeIt = false;
            var child = view.g.children[i];
            var childClasses = child.classList;
            if (childClasses && childClasses.length > 0) {
                if (childClasses[0] == "sqd-label" && childClasses[1] == "sqd-label-primary") {
                    originalRectangleHeight = Number(child.getAttribute("height"));
                    removeIt = true;
                }
            }
            if (child.tagName == "g") {
                var sqdInput = child.querySelector(":scope> .sqd-input");
                if (sqdInput) {
                    /////////////////////////////////////////////////////////////////////////////////////
                    // capture where sqd placed things that were centered here, to use as our x-offset //
                    /////////////////////////////////////////////////////////////////////////////////////
                    var inputX = Number((_a = sqdInput.getAttribute("x")) !== null && _a !== void 0 ? _a : 0);
                    var inputWidth = Number((_b = sqdInput.getAttribute("width")) !== null && _b !== void 0 ? _b : 0);
                    xOffset = (inputX - inputWidth / 2) - 80; // todo#magicNumber (80)
                    removeIt = true;
                }
            }
            if (removeIt) {
                view.g.removeChild(child);
                i--;
            }
        }
        var newHeight = this.stepLabelRectangleReplacement({
            stepContext: stepContext,
            view: view,
            includeOutputTriangle: true,
            doNotRemoveChildren: true,
            type: "switch",
            xOffset: xOffset,
            yOffset: 20,
        }).height;
        //////////////////////////////////////////
        // adjust the lines around the children //
        //////////////////////////////////////////
        var adjustHeightBy = (newHeight - originalRectangleHeight) - 72; // todo#magicNumber (72)
        var hasNoBranches = false;
        if (Object.keys(stepContext.step.branches).length == 0) {
            hasNoBranches = true;
            adjustHeightBy += 19; // todo#magicNumber (19)
        }
        // console.log(`Adjusting height by ${adjustHeightBy} for ${stepContext.step.name}`);
        view.height += adjustHeightBy;
        for (var i = 0; i < view.g.children.length; i++) {
            var child = view.g.children[i];
            var className = this.getClassName(child);
            if (child.nodeName == "line" && className.indexOf("sqd-region") > -1) {
                var y1 = Number(child.getAttribute("y1"));
                var y2 = Number(child.getAttribute("y2"));
                if (y1 == y2 && y1 == 0) {
                    ///////////////////////////
                    // top line - don't move //
                    ///////////////////////////
                }
                else if (y1 == 0) {
                    /////////////////////////////////////////////
                    // vertical line - don't move, but stretch //
                    /////////////////////////////////////////////
                    child.setAttribute("y2", String(y2 + adjustHeightBy));
                }
                else {
                    ////////////////////////
                    // bottom line - move //
                    ////////////////////////
                    child.setAttribute("y1", String(y1 + adjustHeightBy));
                    child.setAttribute("y2", String(y2 + adjustHeightBy));
                }
            }
            else if (child.nodeName == "path" && className.indexOf("sqd-join") > -1) {
                /////////////////
                // a path line //
                /////////////////
                child.setAttribute("transform", "translate(0,".concat(adjustHeightBy, ")"));
            }
            else if (child.nodeName == "line" && className.indexOf("sqd-join") > -1) {
                /////////////////
                // a join line //
                /////////////////
                var y1 = Number(child.getAttribute("y1"));
                var y2 = Number(child.getAttribute("y2"));
                if (y1 > 0) {
                    ////////////////////////////////////////
                    // a non-top join line - move it down //
                    ////////////////////////////////////////
                    child.setAttribute("y1", String(y1 + adjustHeightBy));
                    child.setAttribute("y2", String(y2 + adjustHeightBy));
                }
                else {
                    /////////////////////////////////////////////////////////////////////////////////
                    // for an empty switch, we need to extend the bottom of the top join line down //
                    /////////////////////////////////////////////////////////////////////////////////
                    if (hasNoBranches) {
                        child.setAttribute("y2", String(y2 + adjustHeightBy));
                    }
                }
            }
            else if (child.nodeName == "g" && (className.indexOf("sqd-label-secondary") > -1 || className == "")) {
                if (child.getAttribute("transform")) {
                    child.setAttribute("transform", child.getAttribute("transform") + " translate(0,".concat(adjustHeightBy, ")"));
                }
            }
        }
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processContainer = function (view, stepContext) {
        var _a, _b;
        if (view.g.classList.contains("sqd-collapsed")) {
            this.processCollapsedContainer(view, stepContext);
            return;
        }
        ///////////////////////////////////////////////////////////////
        // remove children that the replacement method will generate //
        // - but not the child steps or lines or container box       //
        ///////////////////////////////////////////////////////////////
        var xOffset = 0;
        var originalRectangleHeight = 0;
        for (var i = 0; i < view.g.children.length; i++) {
            var removeIt = false;
            var child = view.g.children[i];
            var childClasses = child.classList;
            if (childClasses && childClasses.length > 0) {
                if (childClasses[0] == "sqd-label" && childClasses[1] == "sqd-label-primary") {
                    originalRectangleHeight = Number(child.getAttribute("height"));
                    removeIt = true;
                }
            }
            if (child.tagName == "g") {
                var sqdInput = child.querySelector(":scope> .sqd-input");
                if (sqdInput) {
                    /////////////////////////////////////////////////////////////////////////////////////
                    // capture where sqd placed things that were centered here, to use as our x-offset //
                    /////////////////////////////////////////////////////////////////////////////////////
                    var inputX = Number((_a = sqdInput.getAttribute("x")) !== null && _a !== void 0 ? _a : 0);
                    var inputWidth = Number((_b = sqdInput.getAttribute("width")) !== null && _b !== void 0 ? _b : 0);
                    xOffset = (inputX - inputWidth / 2) - 80; // todo#magicNumber (80)
                    removeIt = true;
                }
            }
            if (removeIt) {
                view.g.removeChild(child);
                i--;
            }
        }
        var newHeight = this.stepLabelRectangleReplacement({
            stepContext: stepContext,
            view: view,
            includeOutputTriangle: true,
            doNotRemoveChildren: true,
            type: "container",
            xOffset: xOffset,
            yOffset: 20,
        }).height;
        //////////////////////////////////////////
        // adjust the lines around the children //
        //////////////////////////////////////////
        var increaseWidthHalf = 0;
        var increaseHeightBy = (newHeight - originalRectangleHeight) - 22; // todo#magicNumber (22)
        var fullBoxWidth = 0;
        for (var i = 0; i < view.g.children.length; i++) {
            var child = view.g.children[i];
            var className = this.getClassName(child);
            if (child.nodeName == "line" && className.indexOf("sqd-region") > -1) {
                var x1 = Number(child.getAttribute("x1"));
                var x2 = Number(child.getAttribute("x2"));
                var y1 = Number(child.getAttribute("y1"));
                var y2 = Number(child.getAttribute("y2"));
                if (y1 == y2 && y1 == 0) {
                    ////////////////////////
                    // top line - stretch //
                    ////////////////////////
                    child.setAttribute("x1", String(x1 - increaseWidthHalf));
                    child.setAttribute("x2", String(x2 + increaseWidthHalf));
                    fullBoxWidth = (x2 + increaseWidthHalf) - (x1 - increaseWidthHalf);
                }
                else if (y1 == y2 && y1 != 0) {
                    /////////////////////////////////////////
                    // bottom line - move down and stretch //
                    /////////////////////////////////////////
                    child.setAttribute("x1", String(x1 - increaseWidthHalf));
                    child.setAttribute("x2", String(x2 + increaseWidthHalf));
                    child.setAttribute("y1", String(y1 + increaseHeightBy));
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                }
                else if (y1 == 0 && x1 == 0) {
                    /////////////////////////////////////////////////
                    // left vertical line - move left, and stretch //
                    /////////////////////////////////////////////////
                    child.setAttribute("x1", String(x1 - increaseWidthHalf));
                    child.setAttribute("x2", String(x2 - increaseWidthHalf));
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                }
                else {
                    ///////////////////////////////////////////////////
                    // right vertical line - move right, and stretch //
                    ///////////////////////////////////////////////////
                    child.setAttribute("x1", String(x1 + increaseWidthHalf));
                    child.setAttribute("x2", String(x2 + increaseWidthHalf));
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                }
            }
            else if (className.indexOf("sqd-region-toggle") > -1) {
                ////////////////////////////////////////////////
                // move the toggle to stay in top-left corner //
                ////////////////////////////////////////////////
                child.setAttribute("transform", "translate(-".concat(increaseWidthHalf, ", 0)"));
            }
            else if (child.nodeName == "line" && className.indexOf("sqd-join") > -1 && className.indexOf("clone") == -1) {
                // child.setAttribute("transform", `translate(0,${increaseHeightBy + 26})`);
                child.setAttribute("y2", "20");
                child.setAttribute("data-dk", "yo");
            }
            else if (child.nodeName == "g" && child.children.length > 0 && child.children[0].nodeName == "line") {
                /////////////////////////////////
                // assume this is child steps? //
                /////////////////////////////////
                if (this.getClassName(child.children[0]) == "sqd-join" && !this.getClassName(child.children[0]).includes("clone")) {
                    var wrapperG = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("g", { transform: "translate(".concat(0, ", ").concat(3 + increaseHeightBy, ")") }); // todo - needs some dynamicsm?
                    view.g.append(wrapperG);
                    wrapperG.appendChild(child);
                }
            }
        }
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processCollapsedSwitch = function (view, stepContext) {
        var originalHeight = view.g.getBoundingClientRect().height / this.getCanvasScale();
        var _a = this.stepLabelRectangleReplacement({
            stepContext: stepContext,
            view: view,
            includeOutputTriangle: true,
            doNotRemoveChildren: true,
            type: "collapsedSwitch",
            xOffset: 40,
            yOffset: 20,
        }), newHeight = _a.height, newWidth = _a.width;
        var increaseHeightBy = (newHeight - originalHeight);
        for (var i = 0; i < view.g.children.length; i++) {
            var child = view.g.children[i];
            var className = this.getClassName(child);
            if (child.nodeName == "line" && className.indexOf("sqd-region") > -1) {
                //////////////////////////////////
                // stretch & slide border lines //
                //////////////////////////////////
                var x1 = Number(child.getAttribute("x1"));
                var x2 = Number(child.getAttribute("x2"));
                var y1 = Number(child.getAttribute("y1"));
                var y2 = Number(child.getAttribute("y2"));
                if (y1 == y2 && y1 == 0) {
                    // console.log("top line - stretch and slide left");
                    child.setAttribute("x1", String(0));
                    child.setAttribute("x2", String(newWidth));
                }
                else if (y1 == 0) {
                    // console.log("vertical line - don't move, but stretch");
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                    if (x1 == 0) {
                        ////////////////////////////
                        // left-line, leave alone //
                        ////////////////////////////
                    }
                    else {
                        /////////////////////////
                        // right-line - move x //
                        /////////////////////////
                        child.setAttribute("x1", String(newWidth));
                        child.setAttribute("x2", String(newWidth));
                    }
                }
                else {
                    // console.log("bottom line - move, stretch, slide");
                    child.setAttribute("y1", String(y1 + increaseHeightBy));
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                    child.setAttribute("x1", String(0));
                    child.setAttribute("x2", String(newWidth));
                }
            }
            else if (child.nodeName == "line" && className.indexOf("sqd-join") > -1) {
                /////////////////
                // a path line //
                /////////////////
                child.setAttribute("x1", String(newWidth / 2));
                child.setAttribute("x2", String(newWidth / 2));
                child.setAttribute("y2", String(newHeight));
            }
            else if (className.indexOf("sqd-region-toggle") > -1) {
                ////////////////////////////////////////////////////////////////
                // used to have to move the toggle to stay in top-left corner //
                // but now it's fine as-is                                    //
                ////////////////////////////////////////////////////////////////
            }
            else if (child.nodeName == "g" && className == "") {
                ///////////////////////////////////////////////
                // remove the icon that the library put here //
                ///////////////////////////////////////////////
                view.g.removeChild(child);
                i--;
            }
        }
    };
    StepComponentViewWrapper.prototype.getCanvasScale = function () {
        var canvasG = document.querySelector(".sqd-workspace-canvas g");
        var transform = canvasG === null || canvasG === void 0 ? void 0 : canvasG.getAttribute("transform");
        var match = transform === null || transform === void 0 ? void 0 : transform.match(/scale\(([^)]+)\)/);
        var scaleValue = 1;
        if (match) {
            scaleValue = parseFloat(match[1]);
        }
        return scaleValue;
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processCollapsedContainer = function (view, stepContext) {
        var originalHeight = view.g.getBoundingClientRect().height / this.getCanvasScale();
        var _a = this.stepLabelRectangleReplacement({
            stepContext: stepContext,
            view: view,
            includeOutputTriangle: true,
            doNotRemoveChildren: true,
            type: "collapsedContainer",
            xOffset: 32,
            yOffset: 20,
        }), newHeight = _a.height, newWidth = _a.width;
        var increaseHeightBy = (newHeight - originalHeight);
        for (var i = 0; i < view.g.children.length; i++) {
            var child = view.g.children[i];
            var className = this.getClassName(child);
            if (child.nodeName == "line" && className.indexOf("sqd-region") > -1) {
                //////////////////////////////////
                // stretch & slide border lines //
                //////////////////////////////////
                var x1 = Number(child.getAttribute("x1"));
                var x2 = Number(child.getAttribute("x2"));
                var y1 = Number(child.getAttribute("y1"));
                var y2 = Number(child.getAttribute("y2"));
                if (y1 == y2 && y1 == 0) {
                    // console.log("top line - stretch and slide left");
                    child.setAttribute("x1", String(0));
                    child.setAttribute("x2", String(newWidth));
                }
                else if (y1 == 0) {
                    // console.log("vertical line - don't move, but stretch");
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                    if (x1 == 0) {
                        ////////////////////////////
                        // left-line, leave alone //
                        ////////////////////////////
                    }
                    else {
                        /////////////////////////
                        // right-line - move x //
                        /////////////////////////
                        child.setAttribute("x1", String(newWidth));
                        child.setAttribute("x2", String(newWidth));
                    }
                }
                else {
                    // console.log("bottom line - move, stretch, slide");
                    child.setAttribute("y1", String(y1 + increaseHeightBy));
                    child.setAttribute("y2", String(y2 + increaseHeightBy));
                    child.setAttribute("x1", String(0));
                    child.setAttribute("x2", String(newWidth));
                }
            }
            else if (child.nodeName == "line" && className.indexOf("sqd-join") > -1) {
                /////////////////
                // a path line //
                /////////////////
                child.setAttribute("x1", String(newWidth / 2));
                child.setAttribute("x2", String(newWidth / 2));
                child.setAttribute("y2", String(newHeight));
            }
            else if (className.indexOf("sqd-region-toggle") > -1) {
                ////////////////////////////////////////////////////////////////
                // used to have to move the toggle to stay in top-left corner //
                // but now it's fine as-is                                    //
                ////////////////////////////////////////////////////////////////
            }
            else if (child.nodeName == "g" && className == "") {
                ///////////////////////////////////////////////
                // remove the icon that the library put here //
                ///////////////////////////////////////////////
                view.g.removeChild(child);
                i--;
            }
        }
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processLargeTask = function (view, stepContext) {
        this.stepLabelRectangleReplacement({
            stepContext: stepContext,
            view: view,
            includeOutputTriangle: true
        });
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.stepLabelRectangleReplacement = function (_a) {
        var stepContext = _a.stepContext, view = _a.view, includeOutputTriangle = _a.includeOutputTriangle, doNotRemoveChildren = _a.doNotRemoveChildren, type = _a.type, xOffset = _a.xOffset, yOffset = _a.yOffset;
        var workflowStepType = this.workflowStepTypes[stepContext.step.type];
        var g = view.g;
        g.classList.add("sqd-step-large-task");
        g.setAttribute("data-qswdId", stepContext.step.id);
        if (!doNotRemoveChildren) {
            this.removeAllChildren(g);
        }
        var width = 256;
        var height = 20;
        var iconAreaWidth = this.showIcons ? 60 : 0;
        var paddingX = this.showIcons ? 0 : 8;
        var textWidth = width - iconAreaWidth - 2 * paddingX;
        var cursorY = yOffset !== null && yOffset !== void 0 ? yOffset : 0;
        var innerPaddingY = 12;
        var bottomPaddingY = 0;
        var rect = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("rect", { class: "sqd-large-task-rect", x: xOffset !== null && xOffset !== void 0 ? xOffset : 0, y: yOffset !== null && yOffset !== void 0 ? yOffset : 0, width: width, height: height, rx: 8, ry: 8 });
        g.appendChild(rect);
        if (stepContext.step.properties.isTraced) {
            rect.setAttribute("data-qswdTraced", "true");
        }
        cursorY = this.appendLabelSummaryAndDescription(stepContext, g, textWidth, iconAreaWidth, paddingX, innerPaddingY, cursorY, xOffset !== null && xOffset !== void 0 ? xOffset : 0);
        height = cursorY + bottomPaddingY - (yOffset !== null && yOffset !== void 0 ? yOffset : 0);
        if (this.showIcons) {
            height = this.appendIcon(iconAreaWidth, g, workflowStepType, height, xOffset !== null && xOffset !== void 0 ? xOffset : 0, yOffset !== null && yOffset !== void 0 ? yOffset : 0);
        }
        /////////////////////////
        // add output triangle //
        /////////////////////////
        if (includeOutputTriangle) {
            var polygon = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("polygon", { points: this.getDownArrowPolygonPoints(), fill: "#C0C0C0", stroke: "#808080", transform: "translate(".concat((xOffset !== null && xOffset !== void 0 ? xOffset : 0) + (width / 2), ",0)") });
            view.g.appendChild(polygon);
        }
        //////////////////////////////////
        // set final height on the rect //
        //////////////////////////////////
        rect.setAttribute("height", String(height));
        /////////////////////////////////////////////////////
        // based on type, adjust view height, width, joinx //
        /////////////////////////////////////////////////////
        if (type == "switch") {
            //////////////////////////////////////////////
            // don't adjust these settings for switches //
            //////////////////////////////////////////////
        }
        else if (type == "container") {
            view.height += height - 20; // todo#magicNumber 20
        }
        else if (type == "collapsedContainer") {
            ///////////////////////////////////////////////////////////
            // for collapsed container, need padding outside of rect //
            ///////////////////////////////////////////////////////////
            height += (yOffset !== null && yOffset !== void 0 ? yOffset : 0) * 2 + 3; // todo@magicNumber 3
            width += (xOffset !== null && xOffset !== void 0 ? xOffset : 0) * 2; // - 16 // todo@magicNumber 16
            view.height = height;
            view.width = width;
            view.joinX = (width) / 2;
        }
        else if (type == "collapsedSwitch") {
            ////////////////////////////////////////////////////////
            // for collapsed switch, need padding outside of rect //
            ////////////////////////////////////////////////////////
            height += (yOffset !== null && yOffset !== void 0 ? yOffset : 0) * 2;
            width += (xOffset !== null && xOffset !== void 0 ? xOffset : 0) * 2;
            view.height = height;
            view.width = width;
            view.joinX = (width) / 2;
        }
        else {
            ///////////////////////////////////////////
            // default case - adjust the view's size //
            ///////////////////////////////////////////
            view.height = height;
            view.width = width;
            view.joinX = (width) / 2;
        }
        return ({ height: height, width: width });
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.removeAllChildren = function (g) {
        while (g.children.length > 0) {
            g.removeChild(g.children[0]);
        }
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.appendIcon = function (iconAreaWidth, g, workflowStepType, height, xOffset, yOffset) {
        var iconCircleDiameter = 48;
        var iconImageSize = 32;
        var iconOffset = (iconAreaWidth - 48) / 2;
        var iconOffsetYAdditional = 4;
        g.appendChild(sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("rect", { class: "step-icon-rect", x: iconOffset + xOffset, y: iconOffset + iconOffsetYAdditional + yOffset, width: iconCircleDiameter, height: iconCircleDiameter, rx: iconCircleDiameter / 2, ry: iconCircleDiameter / 2 }));
        if (workflowStepType === null || workflowStepType === void 0 ? void 0 : workflowStepType.iconUrl) {
            var imageOffset = iconOffset + (iconCircleDiameter - iconImageSize) / 2;
            g.appendChild(sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("image", { x: imageOffset + xOffset, y: imageOffset + iconOffsetYAdditional + yOffset, width: iconImageSize, height: iconImageSize, href: workflowStepType.iconUrl }));
        }
        var totalIconHeightWithPadding = iconCircleDiameter + 2 * (iconOffset + iconOffsetYAdditional);
        if (height < totalIconHeightWithPadding) {
            height = totalIconHeightWithPadding;
        }
        return height;
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.appendLabelSummaryAndDescription = function (stepContext, g, textWidth, iconWidth, paddingX, innerPaddingY, cursorY, xOffset) {
        var _a, _b;
        var labelString = stepContext.step.name;
        var _c = this.stringToWrappedSvgTextElement(labelString, 16, g, textWidth), wrappedLabelText = _c[0], labelTextWidth = _c[1], labelTextHeight = _c[2];
        wrappedLabelText.setAttribute("class", "sqd-large-task-name-text");
        wrappedLabelText.setAttribute("transform", "translate(".concat(iconWidth + paddingX + xOffset, ",0)"));
        wrappedLabelText.setAttribute("y", String(cursorY));
        cursorY += labelTextHeight + innerPaddingY;
        g.appendChild(wrappedLabelText);
        var summaryString = (_a = stepContext.step.properties.summary) !== null && _a !== void 0 ? _a : "";
        if (summaryString != "") {
            var _d = this.stringToWrappedSvgTextElement(String(summaryString), 14, g, textWidth), wrappedSummaryText = _d[0], summaryTextWidth = _d[1], summaryTextHeight = _d[2];
            wrappedSummaryText.setAttribute("class", "large-task-summary-text");
            wrappedSummaryText.setAttribute("transform", "translate(".concat(iconWidth + paddingX + xOffset, ",0)"));
            wrappedSummaryText.setAttribute("y", String(cursorY));
            cursorY += summaryTextHeight + innerPaddingY / 2;
            g.appendChild(wrappedSummaryText);
        }
        var descriptionString = (_b = this.makeDescriptionString(stepContext)) !== null && _b !== void 0 ? _b : "";
        if (descriptionString != "") {
            var _e = this.stringToWrappedSvgTextElement(String(descriptionString), 13, g, textWidth), wrappedDescriptionText = _e[0], descriptionTextWidth = _e[1], descriptionTextHeight = _e[2];
            wrappedDescriptionText.setAttribute("class", "large-task-description-text");
            wrappedDescriptionText.setAttribute("transform", "translate(".concat(iconWidth + paddingX + xOffset, ",0)"));
            wrappedDescriptionText.setAttribute("y", String(cursorY));
            cursorY += descriptionTextHeight + innerPaddingY;
            g.appendChild(wrappedDescriptionText);
        }
        else {
            cursorY += innerPaddingY / 2;
        }
        return cursorY;
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processInterruptingTask = function (view, stepContext) {
        this.stepLabelRectangleReplacement({
            stepContext: stepContext,
            view: view,
            includeOutputTriangle: false
        });
        //////////////////////////////////
        // draw stop-sign outbound icon //
        //////////////////////////////////
        var midX = view.width / 2;
        var startY = view.height + 10;
        var stopCircle = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("rect", { class: "stop-icon-circle", x: String(midX - 15), y: String(startY), width: "30", height: "30", rx: "15", ry: "15" });
        view.g.appendChild(stopCircle);
        var stopSquare = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("rect", { class: "stop-icon-square", x: String(Number(stopCircle.getAttribute("x")) + 9), y: String(Number(stopCircle.getAttribute("y")) + 9), width: "12", height: "12" });
        view.g.appendChild(stopSquare);
        var stopLine = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("line", { x1: Number(stopCircle.getAttribute("x")) + 15, x2: Number(stopCircle.getAttribute("x")) + 15, y1: Number(stopCircle.getAttribute("y")) - 10, y2: Number(stopCircle.getAttribute("y")), stroke: "#000000", "stroke-width": "1" });
        view.g.appendChild(stopLine);
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.processBranchLabel = function (g, stepContext, output) {
        var _a, _b, _c, _d, _e, _f;
        var textPadding = 10;
        var rectangle = g.children.item(0);
        var text = g.children.item(1);
        if (text && rectangle) {
            var workflowStepType = this.workflowStepTypes[stepContext.step.type];
            var guardLabels = {};
            if (workflowStepType && workflowStepType.outboundLinkOptions) {
                for (var _i = 0, _g = workflowStepType.outboundLinkOptions; _i < _g.length; _i++) {
                    var option = _g[_i];
                    guardLabels[option.value] = option.label;
                }
            }
            //@ts-ignore
            var outboundLinkLabels = (_c = (_b = (_a = stepContext.step) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b.outboundLinkLabels) !== null && _c !== void 0 ? _c : {};
            for (var value in outboundLinkLabels) {
                guardLabels[value] = outboundLinkLabels[value];
            }
            var originalText = (_d = text.textContent) !== null && _d !== void 0 ? _d : "";
            var replacementText = (_e = guardLabels[originalText]) !== null && _e !== void 0 ? _e : originalText;
            //////////////////////////////////////////////////////////////////////////////////////////////////////
            // originally, we could just look at a step's output to see if matched a branch label's text, to    //
            // determine if the branch should be marked as traced but with the advent of multi-forking steps,   //
            // where the output doesn't match the branch that gets taken, we will also try to iterate over the  //
            // steps in the branch, looking for sub-steps that are traced, and inferring that the label is      //
            // traced based on that.                                                                            //
            // note that a branch that's taken without any steps in it will not get marked as traced in this    //
            // case... which is why we'll keep the test on output as well, so we'll get some coverage from both //
            // sides, but not necessarily quite 100%...                                                         //
            //////////////////////////////////////////////////////////////////////////////////////////////////////
            var isTraced = false;
            if (output == text.textContent) {
                isTraced = true;
            }
            else {
                try {
                    var branch = stepContext.step.branches[originalText];
                    for (var _h = 0, branch_1 = branch; _h < branch_1.length; _h++) {
                        var branchStep = branch_1[_h];
                        if (branchStep.properties.isTraced) {
                            isTraced = true;
                            break;
                        }
                    }
                }
                catch (e) {
                    console.log("Exception checking if branch label is traced", e);
                }
            }
            if (replacementText != originalText) {
                var _j = this.stringToWrappedSvgTextElement(replacementText, 16, g, 180, 1), newText = _j[0], textWidth = _j[1], height = _j[2];
                var rectWidth = textWidth + textPadding * 2;
                rectangle.setAttribute("width", String(rectWidth));
                rectangle.setAttribute("height", String(20 + height));
                rectangle.setAttribute("x", String(-rectWidth / 2));
                rectangle.setAttribute("data-qswdTraced", String(isTraced));
                newText.setAttribute("transform", "translate(".concat(10 + (-rectWidth / 2), ",").concat((Number((_f = rectangle.getAttribute("y")) !== null && _f !== void 0 ? _f : 0)) + 5, ")"));
                g.replaceChild(newText, text);
            }
        }
    };
    /***************************************************************************
     **
     ***************************************************************************/
    StepComponentViewWrapper.prototype.stringToWrappedSvgTextElement = function (inputString, fontSizePx, g, maxWidth, maxLines) {
        if (maxWidth === void 0) { maxWidth = 100; }
        var text = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("text");
        text.setAttribute("x", "0");
        text.setAttribute("y", "0");
        text.setAttribute("font-size", fontSizePx + "px");
        g.appendChild(text);
        var lineHeight = 1.2 * fontSizePx;
        var tspans = [];
        var greatestWidth = 0;
        var paragraphs = inputString.split("\n");
        var height = 0;
        var _loop_1 = function (paragraph) {
            if (paragraph.length == 0) {
                return "continue";
            }
            var words = paragraph.split(" ");
            var line = [];
            words.forEach(function (word) {
                line.push(word);
                text.textContent = line.join(" ");
                if (text.getComputedTextLength() > maxWidth) {
                    line.pop();
                    text.textContent = line.join(" ");
                    greatestWidth = Math.max(greatestWidth, text.getComputedTextLength());
                    var tspan_1 = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("tspan");
                    tspan_1.setAttribute("x", "0");
                    tspan_1.setAttribute("dy", String(fontSizePx * 1.2));
                    tspan_1.textContent = line.join(" ");
                    tspans.push(tspan_1);
                    // todo#sizey height += (1.1175 * text.getBoundingClientRect().height);
                    height += lineHeight;
                    line = [word];
                }
            });
            text.textContent = line.join(" ");
            greatestWidth = Math.max(greatestWidth, text.getComputedTextLength());
            ///////////////////////////
            // Append the final line //
            ///////////////////////////
            var tspan = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("tspan");
            tspan.setAttribute("x", "0");
            tspan.setAttribute("dy", String(fontSizePx * 1.2));
            tspan.textContent = line.join(" ");
            tspans.push(tspan);
            // todo#sizey height += (1.1175 * text.getBoundingClientRect().height);
            height += lineHeight;
        };
        for (var _i = 0, paragraphs_1 = paragraphs; _i < paragraphs_1.length; _i++) {
            var paragraph = paragraphs_1[_i];
            _loop_1(paragraph);
        }
        if (maxLines && tspans.length > maxLines) {
            height -= lineHeight * (tspans.length - maxLines);
            tspans.splice(maxLines);
        }
        g.removeChild(text);
        var rs = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("text");
        tspans.forEach(function (tspan) { return rs.appendChild(tspan); });
        return ([rs, greatestWidth, height]);
    };
    /***************************************************************************
     *
     ***************************************************************************/
    StepComponentViewWrapper.prototype.makeDescriptionString = function (stepContext) {
        var rs = "";
        if (stepContext.step.properties.qswdDescription) {
            rs += String(stepContext.step.properties.qswdDescription);
        }
        if (stepContext.step.properties.output != null) {
            rs += "\nOutput: " + stepContext.step.properties.output;
        }
        if (stepContext.step.properties.logMessage != null) {
            rs += "\nMessage: " + stepContext.step.properties.logMessage;
        }
        return (rs);
    };
    return StepComponentViewWrapper;
}());



/***/ },

/***/ "./src/component/StepEditor.tsx"
/*!**************************************!*\
  !*** ./src/component/StepEditor.tsx ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   StepEditor: () => (/* binding */ StepEditor)
/* harmony export */ });
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/metaData/QFieldMetaData.js");
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/QRecord */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QRecord.js");
/* harmony import */ var dompurify__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! dompurify */ "./node_modules/dompurify/dist/purify.es.mjs");
/* harmony import */ var form_data__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! form-data */ "./node_modules/form-data/lib/browser.js");
/* harmony import */ var form_data__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(form_data__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! sequential-workflow-designer-react */ "./node_modules/sequential-workflow-designer-react/lib/esm/index.js");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (undefined && undefined.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};






StepEditor.defaultProps = {};
/***************************************************************************
 **
 ***************************************************************************/
function StepEditor(_a) {
    var _this = this;
    var _b;
    var qfmdBridge = _a.qfmdBridge, workflowStepTypes = _a.workflowStepTypes, controller = _a.controller, workflow = _a.workflow, workflowRevision = _a.workflowRevision, workflowType = _a.workflowType, qContext = _a.qContext;
    var _c = (0,sequential_workflow_designer_react__WEBPACK_IMPORTED_MODULE_5__.useStepEditor)(), type = _c.type, properties = _c.properties, setProperty = _c.setProperty, step = _c.step;
    var record = new _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_1__.QRecord({ values: properties });
    var _d = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(null), pendingFieldChangeConfirmation = _d[0], setPendingFieldChangeConfirmation = _d[1];
    var _e = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(0), formRenderNonce = _e[0], setFormRenderNonce = _e[1];
    var _f = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(null), debounceHandleFieldChangeTimeout = _f[0], setDebounceHandleFieldChangeTimeout = _f[1];
    var _g = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(null), debounceWidgetCallbackTimeout = _g[0], setDebounceWidgetCallbackTimeout = _g[1];
    var _h = (0,react__WEBPACK_IMPORTED_MODULE_4__.useState)(new URLSearchParams()), queryParams = _h[0], setQueryParams = _h[1];
    (0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(function () {
        setQueryParams(new URLSearchParams(window.location.search));
    }, []);
    var workflowStepType = workflowStepTypes === null || workflowStepTypes === void 0 ? void 0 : workflowStepTypes[type];
    if (!workflowStepType) {
        return react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", null,
            "Unrecognized step type: ",
            type,
            "...");
    }
    /***************************************************************************
     * make a call to the backend to fetch data about the step, that need to change
     * as the step is edited.
     ***************************************************************************/
    var updateDynamicValues = function () {
        var summary = "…";
        setProperty("summary", summary);
        controller === null || controller === void 0 ? void 0 : controller.updateRootComponent();
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var values, postData, getDynamicValuesProcessResponse, processResultValues, summary, outboundLinkOptions, outboundLinkLabels, _i, outboundLinkOptions_1, outboundLinkOption;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        values = Object.assign({}, properties);
                        delete (values.summary);
                        delete (values.description);
                        values.workflowRevision = workflowRevision;
                        values.workflow = workflow;
                        postData = new (form_data__WEBPACK_IMPORTED_MODULE_3___default())();
                        postData.append("workflowStepTypeName", workflowStepType.name);
                        postData.append("workflowId", workflow === null || workflow === void 0 ? void 0 : workflow.id);
                        postData.append("values", JSON.stringify(values));
                        return [4 /*yield*/, ((_a = qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.qController) === null || _a === void 0 ? void 0 : _a.processRun("getWorkflowStepDynamicValues", postData, undefined, true))];
                    case 1:
                        getDynamicValuesProcessResponse = _b.sent();
                        processResultValues = getDynamicValuesProcessResponse.values;
                        summary = processResultValues.summary;
                        setProperty("summary", summary);
                        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
                        // for variable-outbound-link steps types, we also should get back outbound-link-options from this call. //
                        // proces those now - which may update the graph!                                                        //
                        ///////////////////////////////////////////////////////////////////////////////////////////////////////////
                        if (workflowStepType.outboundLinkMode == "VARIABLE") {
                            if (processResultValues.outboundLinkOptions) {
                                outboundLinkOptions = processResultValues.outboundLinkOptions;
                                mergeOutboundLinks(step, outboundLinkOptions);
                                outboundLinkLabels = {};
                                for (_i = 0, outboundLinkOptions_1 = outboundLinkOptions; _i < outboundLinkOptions_1.length; _i++) {
                                    outboundLinkOption = outboundLinkOptions_1[_i];
                                    outboundLinkLabels[outboundLinkOption.value] = outboundLinkOption.label;
                                }
                                setProperty("outboundLinkLabels", outboundLinkLabels);
                            }
                        }
                        controller === null || controller === void 0 ? void 0 : controller.updateRootComponent();
                        return [2 /*return*/];
                }
            });
        }); })();
    };
    /***************************************************************************
     * deal with a graph having links in it, but then different links coming
     * from the backend - try to keep them based on their condition values
     * matching.
     ***************************************************************************/
    function mergeOutboundLinks(step, outboundLinkOptions) {
        var toDelete = Object.keys(step.branches);
        var orderedBranchNames = [];
        for (var _i = 0, outboundLinkOptions_2 = outboundLinkOptions; _i < outboundLinkOptions_2.length; _i++) {
            var outboundLinkOption = outboundLinkOptions_2[_i];
            /////////////////////////////////////////////////////////
            // remove this key from the set of those to be deleted //
            /////////////////////////////////////////////////////////
            var i = toDelete.indexOf(outboundLinkOption.value);
            if (i > -1) {
                toDelete.splice(i, 1);
            }
            ///////////////////////////////////////////////////////
            // keep existing branch under this key if one exists //
            ///////////////////////////////////////////////////////
            if (!step.branches[outboundLinkOption.value]) {
                step.branches[outboundLinkOption.value] = [];
            }
            orderedBranchNames.push(outboundLinkOption.value);
        }
        setProperty("branchNames", orderedBranchNames);
        for (var _a = 0, toDelete_1 = toDelete; _a < toDelete_1.length; _a++) {
            var key = toDelete_1[_a];
            delete (step.branches[key]);
        }
    }
    /***************************************************************************
     **
     ***************************************************************************/
    var handleFieldChange = function (fieldName, value) {
        var _a;
        if (fieldName === "inputFieldName" || fieldName === "outputFieldName") {
            var existingMappingsValue = (_a = properties.records) !== null && _a !== void 0 ? _a : record.values.get("records");
            var hasExistingMappings = false;
            if (existingMappingsValue) {
                try {
                    var parsedRecords = JSON.parse(String(existingMappingsValue));
                    hasExistingMappings = Array.isArray(parsedRecords) && parsedRecords.length > 0;
                }
                catch (e) {
                    hasExistingMappings = String(existingMappingsValue).trim() !== "" && String(existingMappingsValue).trim() !== "[]";
                }
            }
            if (hasExistingMappings && properties[fieldName] !== value) {
                setPendingFieldChangeConfirmation({ fieldName: fieldName, value: value });
                return;
            }
        }
        applyFieldChange(fieldName, value, false);
    };
    /***************************************************************************
     * Apply a change from the editor form. For input/output field changes, if
     * mappings must be cleared, do that in the same applied change path so the
     * widget does not retain stale row data.
     ***************************************************************************/
    var applyFieldChange = function (fieldName, value, clearMappings) {
        if (fieldName === "inputFieldName" || fieldName === "outputFieldName") {
            clearTimeout(debounceHandleFieldChangeTimeout);
            setDebounceHandleFieldChangeTimeout(null);
            if (clearMappings) {
                setProperty("records", "[]");
            }
            setProperty(fieldName, value);
            updateDynamicValues();
            controller === null || controller === void 0 ? void 0 : controller.updateRootComponent();
            return;
        }
        clearTimeout(debounceHandleFieldChangeTimeout);
        var timeout = setTimeout(function () {
            setDebounceHandleFieldChangeTimeout(null);
            if (fieldName == "qswdDescription") {
                setDescription(fieldName, value);
            }
            else {
                setProperty(fieldName, value);
                updateDynamicValues();
            }
        }, 503);
        setDebounceHandleFieldChangeTimeout(timeout);
    };
    /***************************************************************************
     * callbacks for the styled "clear mappings" confirmation modal
     ***************************************************************************/
    var confirmFieldChange = function () {
        if (!pendingFieldChangeConfirmation) {
            return;
        }
        applyFieldChange(pendingFieldChangeConfirmation.fieldName, pendingFieldChangeConfirmation.value, true);
        setPendingFieldChangeConfirmation(null);
        setFormRenderNonce(function (previous) { return previous + 1; });
    };
    /***************************************************************************
     *
     ***************************************************************************/
    var cancelFieldChangeConfirmation = function () {
        setPendingFieldChangeConfirmation(null);
        setFormRenderNonce(function (previous) { return previous + 1; });
        controller === null || controller === void 0 ? void 0 : controller.updateRootComponent();
    };
    /***************************************************************************
     **
     ***************************************************************************/
    var setDescription = function (fieldName, value) {
        setProperty(fieldName, value);
        controller === null || controller === void 0 ? void 0 : controller.updateRootComponent();
    };
    /***************************************************************************
     **
     ***************************************************************************/
    var widgetActionCallback = function (data, eventValues) {
        clearTimeout(debounceWidgetCallbackTimeout);
        var timeout = setTimeout(function () {
            setDebounceWidgetCallbackTimeout(null);
            for (var key in data !== null && data !== void 0 ? data : {}) {
                setProperty(key, data[key]);
            }
            updateDynamicValues();
        }, 504);
        setDebounceWidgetCallbackTimeout(timeout);
        return (true);
    };
    /***************************************************************************
     **
     ***************************************************************************/
    function noop() {
    }
    var fields = [];
    fields.push(new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({ name: "qswdDescription", label: "Step Description", type: "STRING", gridColumns: 12 }));
    fields.push(new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({ name: "workflowValuesJSON", label: "Workflow Values", type: "STRING", gridColumns: 12, isHidden: true }));
    record.values.set("workflowValuesJSON", JSON.stringify(workflow));
    fields.push(new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({ name: "workflowRevisionValuesJSON", label: "Workflow Revision Values", type: "STRING", gridColumns: 12, isHidden: true }));
    record.values.set("workflowRevisionValuesJSON", JSON.stringify(workflowRevision));
    for (var _i = 0, _j = (workflowStepType.inputFields || []); _i < _j.length; _i++) {
        var inputField = _j[_i];
        fields.push(inputField);
    }
    //////////////////////////////////////////////////////////////////////////////////////////////////
    // set workflow & workflowRevision values in the record that'll be passed in to support widgets
    // also set these as hidden fields, to be available, e.g., to possible values as "otherValues"
    //////////////////////////////////////////////////////////////////////////////////////////////////
    if (workflow) {
        Object.keys(workflow).forEach(function (key) {
            ////////////////////////////////////////
            // @ts-ignore random keys on workflow //
            ////////////////////////////////////////
            record.values.set("workflow.".concat(key), workflow[key]);
            fields.push(new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({ name: "workflow.".concat(key), type: "STRING", isHidden: true }));
        });
    }
    if (workflowRevision) {
        Object.keys(workflowRevision).forEach(function (key) {
            ////////////////////////////////////////////////
            // @ts-ignore random keys on workflowRevision //
            ////////////////////////////////////////////////
            record.values.set("workflowRevision.".concat(key), workflowRevision[key]);
            fields.push(new _qrunio_qqq_frontend_core_lib_model_metaData_QFieldMetaData__WEBPACK_IMPORTED_MODULE_0__.QFieldMetaData({ name: "workflowRevision.".concat(key), type: "STRING", isHidden: true }));
        });
    }
    //////////////////////////////////////////////////////////
    // on first render, update summary (for default values) //
    //////////////////////////////////////////////////////////
    ;(0,react__WEBPACK_IMPORTED_MODULE_4__.useEffect)(function () {
        if (properties["summary"] === undefined) {
            updateDynamicValues();
        }
    }, []);
    var descriptionHTML = (0,react__WEBPACK_IMPORTED_MODULE_4__.useMemo)(function () { var _a; return dompurify__WEBPACK_IMPORTED_MODULE_2__["default"].sanitize((_a = workflowStepType.description) !== null && _a !== void 0 ? _a : ""); }, [workflowStepType.description]);
    var clearMappingsModalBody = react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { width: "520px", background: "white", padding: "1rem 1rem 0.875rem 1rem", borderRadius: "1rem", margin: "auto", marginTop: "calc(40vh)" } },
        react__WEBPACK_IMPORTED_MODULE_4___default().createElement("h3", { style: { fontSize: "1.125rem", margin: 0 } }, "Clear Existing Value Mappings"),
        react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { margin: "0.75rem 0 0.875rem 0", fontSize: "0.95rem", lineHeight: 1.45 } }, "Changing the Input Field or Output Field will clear all existing value mappings for this step."),
        react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { display: "flex", justifyContent: "flex-end" } },
            react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "160px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Cancel", cancelFieldChangeConfirmation, { variant: "gradient", color: "dark" })),
            react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { display: "inline-block", marginRight: "10px", width: "160px" } }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeButton("Clear mappings", confirmFieldChange, { variant: "gradient", color: "info" }))));
    function onClearMappingsModalClose(setIsOpen, event, reason) {
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
            return;
        }
        setIsOpen(false);
        cancelFieldChangeConfirmation();
    }
    return (react__WEBPACK_IMPORTED_MODULE_4___default().createElement((react__WEBPACK_IMPORTED_MODULE_4___default().Fragment), null,
        react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { width: "100%" } },
            queryParams.has("helpHelp") && react__WEBPACK_IMPORTED_MODULE_4___default().createElement("h2", null,
                "[workflowStepType:",
                react__WEBPACK_IMPORTED_MODULE_4___default().createElement("wbr", null),
                workflowStepType.name,
                ";",
                react__WEBPACK_IMPORTED_MODULE_4___default().createElement("wbr", null),
                "slot:label]"),
            react__WEBPACK_IMPORTED_MODULE_4___default().createElement("h2", null, workflowStepType.label),
            workflowStepType.description &&
                react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { padding: "0.5rem 0" }, className: "helpContent" },
                    queryParams.has("helpHelp") && react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { paddingBottom: "0.5rem" } },
                        "[workflowStepType:",
                        react__WEBPACK_IMPORTED_MODULE_4___default().createElement("wbr", null),
                        workflowStepType.name,
                        ";",
                        react__WEBPACK_IMPORTED_MODULE_4___default().createElement("wbr", null),
                        "slot:description]"),
                    react__WEBPACK_IMPORTED_MODULE_4___default().createElement("span", { dangerouslySetInnerHTML: { __html: descriptionHTML } })),
            react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { key: "stepEditorForm.".concat(formRenderNonce) }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeForm(fields, record, handleFieldChange, noop, ["ALL_SCREENS"], "workflowStepType:".concat(workflowStepType.name, ";"))),
            react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { style: { paddingTop: "1rem" } }, (_b = workflowStepType.inputWidgetNames) === null || _b === void 0 ? void 0 : _b.map(function (name, index) {
                return (react__WEBPACK_IMPORTED_MODULE_4___default().createElement("div", { key: index, className: "qswdStepEditorWidgetWrapper ".concat(name) }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeWidget(name, undefined, undefined, record, widgetActionCallback, qContext)));
            }))),
        pendingFieldChangeConfirmation && (qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeModal(clearMappingsModalBody, onClearMappingsModalClose, qContext))));
}


/***/ },

/***/ "./src/component/TestRun.tsx"
/*!***********************************!*\
  !*** ./src/component/TestRun.tsx ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   TestRunView: () => (/* binding */ TestRunView)
/* harmony export */ });
/* harmony import */ var _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @qrunio/qqq-frontend-core/lib/model/QRecord */ "./node_modules/@qrunio/qqq-frontend-core/lib/model/QRecord.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
var __assign = (undefined && undefined.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};


var statusMap = { 1: "PASS", 2: "FAIL", 3: "ERROR" };
var statusIconMap = { 1: "check", "PASS": "check", 2: "error_outline", "FAIL": "error_outline", 3: "warning", "ERROR": "warning" };
var pl0_25 = { paddingLeft: "0.25rem" };
var pl2_5 = { paddingLeft: "2.5rem" };
var pl1_5 = { paddingLeft: "1.5rem" };
var pt0_125 = { paddingTop: "0.125rem" };
var pt0_25 = { paddingTop: "0.25rem" };
var pt0_5 = { paddingTop: "0.5rem" };
/***************************************************************************
 *
 ***************************************************************************/
function TestRunView(_a) {
    var _b, _c, _d, _e, _f, _g, _h;
    var testRun = _a.testRun, qfmdBridge = _a.qfmdBridge;
    var formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: true, second: "2-digit" });
    var parts = formatter.formatToParts(testRun.timestamp);
    var hour = (_b = parts.find(function (p) { return p.type === "hour"; })) === null || _b === void 0 ? void 0 : _b.value;
    var minute = (_c = parts.find(function (p) { return p.type === "minute"; })) === null || _c === void 0 ? void 0 : _c.value;
    var second = (_d = parts.find(function (p) { return p.type === "second"; })) === null || _d === void 0 ? void 0 : _d.value;
    var timeString = "".concat(hour, ":").concat(minute, ":").concat(second);
    var _j = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false), isOpen = _j[0], setIsOpen = _j[1];
    var _k = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({}), isScenarioOpen = _k[0], setIsScenarioOpen = _k[1];
    var toggleOpen = function () { return setIsOpen(!isOpen); };
    var toggleScenarioOpen = function (index) {
        var newState = __assign({}, isScenarioOpen);
        newState[index] = !isScenarioOpen[index];
        setIsScenarioOpen(newState);
    };
    var completeLI = react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", null);
    if (testRun.state == "complete" && testRun.values) {
        var values_1 = testRun.values;
        // @ts-ignore testRun property
        var testRunRecord = new _qrunio_qqq_frontend_core_lib_model_QRecord__WEBPACK_IMPORTED_MODULE_0__.QRecord(testRun.values.testRun);
        var runScenarioRecords = (_e = testRunRecord.associatedRecords) === null || _e === void 0 ? void 0 : _e.get("scenarios");
        var ratio = testRun.workflowTestScenarioId
            ? ((_f = runScenarioRecords === null || runScenarioRecords === void 0 ? void 0 : runScenarioRecords[0]) === null || _f === void 0 ? void 0 : _f.values.get("assertionPassCount")) + "/" + ((_g = runScenarioRecords === null || runScenarioRecords === void 0 ? void 0 : runScenarioRecords[0]) === null || _g === void 0 ? void 0 : _g.values.get("assertionCount"))
            : (testRunRecord === null || testRunRecord === void 0 ? void 0 : testRunRecord.values.get("scenarioPassCount")) + "/" + (testRunRecord === null || testRunRecord === void 0 ? void 0 : testRunRecord.values.get("scenarioCount"));
        var link = "/developer/workflowTestRun/".concat(testRunRecord.values.get("id"));
        completeLI = react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", null,
            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null,
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { onClick: toggleOpen, className: "disclosure" }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(isOpen ? "arrow_drop_down" : "arrow_right")),
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { className: values_1.status }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(statusIconMap[values_1.status])),
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign({}, pl0_25) }, timeString),
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign({}, pl0_25) }, ratio),
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign(__assign({}, pl0_25), { fontStyle: testRun.workflowTestScenarioId ? "normal" : "italic" }) },
                    react__WEBPACK_IMPORTED_MODULE_1___default().createElement("a", { href: link, target: "_blank" }, values_1.name))),
            isOpen && react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null, testRun.workflowTestScenarioId
                ? react__WEBPACK_IMPORTED_MODULE_1___default().createElement(TestRunScenarioView, { testRun: testRun, runScenario: runScenarioRecords === null || runScenarioRecords === void 0 ? void 0 : runScenarioRecords[0], qfmdBridge: qfmdBridge })
                : react__WEBPACK_IMPORTED_MODULE_1___default().createElement("ul", null, runScenarioRecords === null || runScenarioRecords === void 0 ? void 0 : runScenarioRecords.map(function (runScenario, index) {
                    var _a;
                    var status = statusMap[runScenario.values.get("status")];
                    var scenarioId = runScenario.values.get("workflowTestScenarioId");
                    // @ts-ignore
                    var name = (_a = values_1["scenarioNames"][scenarioId]) !== null && _a !== void 0 ? _a : "Scenario ".concat(scenarioId);
                    var ratio = runScenario.values.get("assertionPassCount") + "/" + runScenario.values.get("assertionCount");
                    return (react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", { key: "scenario-".concat(index, "-").concat(runScenario.values.get("id")) },
                        react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null,
                            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { onClick: function () { return toggleScenarioOpen(index); }, className: "disclosure" }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(isScenarioOpen[index] ? "arrow_drop_down" : "arrow_right")),
                            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { className: status }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(statusIconMap[status])),
                            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign({}, pl0_25) }, ratio),
                            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign({}, pl0_25) }, name)),
                        isScenarioOpen[index] && react__WEBPACK_IMPORTED_MODULE_1___default().createElement(TestRunScenarioView, { testRun: testRun, runScenario: runScenario, qfmdBridge: qfmdBridge })));
                }))));
    }
    return (react__WEBPACK_IMPORTED_MODULE_1___default().createElement((react__WEBPACK_IMPORTED_MODULE_1___default().Fragment), null, testRun.state == "running"
        ? react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", { style: __assign(__assign({}, pl0_25), pt0_5) },
            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: { padding: "0 0.25rem" } }, "\u2022"),
            " ",
            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { className: "icon-spin" }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon("hourglass_empty")),
            " ",
            timeString,
            " Running...")
        : (testRun.state == "incomplete" || !testRun.values)
            ? react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", { style: __assign(__assign({}, pl0_25), pt0_25) },
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: { padding: "0 0.25rem" } }, "\u2022"),
                " ",
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { className: "ERROR" }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(statusIconMap["ERROR"])),
                " ",
                timeString,
                " ", (_h = testRun.errorMessage) !== null && _h !== void 0 ? _h : "Results Unavailable...")
            : completeLI));
}
/***************************************************************************
 *
 ***************************************************************************/
function TestRunScenarioView(_a) {
    var _b;
    var runScenario = _a.runScenario, testRun = _a.testRun, qfmdBridge = _a.qfmdBridge;
    var outputRecords = (_b = runScenario === null || runScenario === void 0 ? void 0 : runScenario.associatedRecords) === null || _b === void 0 ? void 0 : _b.get("outputs");
    var _c = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({}), isOutputOpen = _c[0], setIsOutputOpen = _c[1];
    var _d = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false), isOutputDataOpen = _d[0], setIsOutputDataOpen = _d[1];
    var _e = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(false), showCopiedIcon = _e[0], setShowCopiedIcon = _e[1];
    var toggleOutputDataOpen = function () { return setIsOutputDataOpen(!isOutputDataOpen); };
    var toggleOutputOpen = function (index) {
        var newState = __assign({}, isOutputOpen);
        newState[index] = !isOutputOpen[index];
        setIsOutputOpen(newState);
    };
    if (!outputRecords) {
        return react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null, "Details not available");
    }
    var hasOutputData = runScenario === null || runScenario === void 0 ? void 0 : runScenario.values.get("outputData");
    var formattedOutputData = hasOutputData ? JSON.stringify(JSON.parse(runScenario === null || runScenario === void 0 ? void 0 : runScenario.values.get("outputData")), null, 3) : "";
    function copyOutputData() {
        if (hasOutputData) {
            navigator.clipboard.writeText(formattedOutputData);
            setShowCopiedIcon(true);
            setTimeout(function () { return setShowCopiedIcon(false); }, 1500);
        }
        else {
            alert("Output data not available to copy.");
        }
    }
    return react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null,
        react__WEBPACK_IMPORTED_MODULE_1___default().createElement("ul", null, outputRecords === null || outputRecords === void 0 ? void 0 :
            outputRecords.map(function (output, index) {
                var _a, _b, _c;
                var status = statusMap[output.values.get("status")];
                var assertionId = output.values.get("workflowTestAssertionId");
                // @ts-ignore
                var name = (_c = (_b = (_a = testRun === null || testRun === void 0 ? void 0 : testRun.values) === null || _a === void 0 ? void 0 : _a["assertionNames"]) === null || _b === void 0 ? void 0 : _b[assertionId]) !== null && _c !== void 0 ? _c : "Assertion ".concat(assertionId);
                return (react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", { key: "output-".concat(index, "-").concat(output.values.get("id")) },
                    react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null,
                        react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { onClick: function () { return toggleOutputOpen(index); }, className: "disclosure" }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(isOutputOpen[index] ? "arrow_drop_down" : "arrow_right")),
                        react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { className: status }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(statusIconMap[status])),
                        react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign({}, pl0_25) }, name)),
                    isOutputOpen[index] && react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", { style: __assign(__assign({}, pl2_5), pt0_125) },
                        react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", null, output.values.get("message")))));
            }),
            react__WEBPACK_IMPORTED_MODULE_1___default().createElement("li", null,
                react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", null,
                    react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { onClick: function () { return toggleOutputDataOpen(); }, className: "disclosure" }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon(isOutputDataOpen ? "arrow_drop_down" : "arrow_right")),
                    react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { style: __assign({}, pl0_25) }, "Output Data"),
                    react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { onClick: copyOutputData, style: __assign(__assign({}, pl0_25), { cursor: "pointer" }) }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon("content_copy")),
                    showCopiedIcon && react__WEBPACK_IMPORTED_MODULE_1___default().createElement("span", { className: "PASS", style: __assign({}, pl0_25) }, qfmdBridge === null || qfmdBridge === void 0 ? void 0 : qfmdBridge.makeIcon("check"))),
                isOutputDataOpen && hasOutputData && react__WEBPACK_IMPORTED_MODULE_1___default().createElement("div", { className: "outputData", style: __assign({}, pl1_5) }, formattedOutputData),
                isOutputDataOpen && !hasOutputData && react__WEBPACK_IMPORTED_MODULE_1___default().createElement("i", null, "Output Data Not Available"))));
}


/***/ },

/***/ "./src/component/WorkflowDesignerExtensions.ts"
/*!*****************************************************!*\
  !*** ./src/component/WorkflowDesignerExtensions.ts ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createCollapsibleWorkflowRegion: () => (/* binding */ createCollapsibleWorkflowRegion),
/* harmony export */   createWorkflowDesignerExtensions: () => (/* binding */ createWorkflowDesignerExtensions)
/* harmony export */ });
/* harmony import */ var sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sequential-workflow-designer */ "./node_modules/sequential-workflow-designer/lib/esm/index.js");

/***************************************************************************
 ** Use the public designer APIs for workflow interactions and task views.
 ** The application wrapper supplies the final task label, summary and icon.
 ***************************************************************************/
function createWorkflowDesignerExtensions(wrapper) {
    var taskView = {
        paddingLeft: 12,
        paddingRight: 24,
        paddingY: 12,
        textMarginLeft: 8,
        minTextWidth: 126,
        iconSize: 46,
        radius: 8,
        inputSize: 10,
        outputSize: 10
    };
    return {
        stepComponentViewWrapper: wrapper,
        regionComponentView: createCollapsibleWorkflowRegion(),
        steps: [
            {
                componentType: "interruptingTask",
                createComponentView: (0,sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.createTaskStepComponentViewFactory)(true, taskView)
            },
            {
                componentType: "largeTask",
                createComponentView: (0,sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.createTaskStepComponentViewFactory)(false, taskView)
            }
        ],
        draggedComponent: {
            create: function (parent, step) {
                var element = document.createElement("div");
                element.textContent = step.name;
                element.className = "qswdCustomDraggedComponent";
                parent.appendChild(element);
                return {
                    width: 100,
                    height: 40,
                    destroy: function () { return element.remove(); }
                };
            }
        },
        wheelController: {
            create: function (viewport, workspace) { return ({
                onWheel: function (event) {
                    event.preventDefault();
                    var current = workspace.getViewport();
                    var canvasSize = workspace.getCanvasSize();
                    // Normalize line/page scrolling before applying canvas pixel offsets.
                    var deltaUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvasSize.y : 1;
                    var deltaX = event.deltaX * deltaUnit;
                    var deltaY = event.deltaY * deltaUnit;
                    if (event.ctrlKey || event.metaKey) {
                        var scale = viewport.limitScale(current.scale * Math.exp(-deltaY * 0.01));
                        var pointer = new sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Vector(event.clientX, event.clientY).subtract(workspace.getCanvasPosition());
                        // Keep the workflow point under the pointer stationary during zoom.
                        var position = pointer.subtract(pointer.subtract(current.position).multiplyByScalar(scale / current.scale));
                        workspace.setViewport({ position: position, scale: scale });
                    }
                    else {
                        var delta = event.shiftKey && deltaX === 0 ? new sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Vector(deltaY, 0) : new sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Vector(deltaX, deltaY);
                        workspace.setViewport({ position: current.position.subtract(delta), scale: current.scale });
                    }
                }
            }); }
        }
    };
}
/***************************************************************************
 ** Collapse presentation only: the original definition and output semantics
 ** remain intact, and the designer continues validating hidden descendants.
 ***************************************************************************/
function createCollapsibleWorkflowRegion() {
    var defaultRegion = new sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.DefaultRegionComponentViewExtension();
    return {
        create: function (parent, className, stepContext, viewContext, contentFactory) {
            var expanded = defaultRegion.create(parent, className, stepContext, viewContext, contentFactory);
            var collapsed = !stepContext.isPreview && viewContext.getPreference("qqq-region-collapsed") === "true";
            var view = expanded;
            if (collapsed) {
                var g_1 = expanded.g;
                g_1.replaceChildren();
                g_1.classList.add("sqd-collapsed");
                var width = 320;
                var height = 110;
                var region_1 = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.DefaultRegionView.create(g_1, [width], height);
                // The application's StepComponentViewWrapper renders the collapsed label.
                view = {
                    g: g_1,
                    width: width,
                    height: height,
                    joinX: width / 2,
                    components: null,
                    placeholders: null,
                    hasOutput: expanded.hasOutput,
                    haveCollapsedChildren: true,
                    getClientPosition: function () { return region_1.getClientPosition(); },
                    resolveClick: function (click) {
                        // The application wrapper resizes this view to fit its label.
                        // Hit testing must use the final dimensions, including zoom.
                        var delta = click.position.subtract(view.getClientPosition());
                        return delta.x >= 0 && delta.y >= 0 && delta.x < view.width * click.scale && delta.y < view.height * click.scale ? true : null;
                    },
                    setIsSelected: function (value) { return region_1.setIsSelected(value); },
                    setIsDragging: function (value) { return sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.toggleClass(g_1, value, "sqd-dragging"); },
                    setIsDisabled: function (value) { return sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.toggleClass(g_1, value, "sqd-disabled"); }
                };
            }
            if (!stepContext.isPreview) {
                addCollapseToggle(view, collapsed, stepContext.step, viewContext);
            }
            return view;
        }
    };
}
/***************************************************************************
 ** Return the designer's rerender command so collapsing does not edit the
 ** workflow or bypass the designer's normal click/drag handling.
 ***************************************************************************/
function addCollapseToggle(view, collapsed, step, context) {
    var toggle = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("g", { class: "sqd-region-toggle", "aria-label": collapsed ? "Expand region" : "Collapse region", "aria-expanded": String(!collapsed) });
    toggle.appendChild(sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("rect", { x: 2, y: 2, width: 22, height: 22, rx: 3, fill: "white", stroke: "#808080" }));
    var label = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.Dom.svg("text", { x: 13, y: 18, "text-anchor": "middle", fill: "#404040" });
    label.textContent = collapsed ? "+" : "-";
    toggle.appendChild(label);
    view.g.appendChild(toggle);
    var resolveClick = view.resolveClick.bind(view);
    view.resolveClick = function (click) { return toggle.contains(click.element) ? {
        type: sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_0__.ClickCommandType.rerenderStep,
        step: step,
        beforeCallback: function () { return context.setPreference("qqq-region-collapsed", String(!collapsed)); }
    } : resolveClick(click); };
}


/***/ },

/***/ "./src/component/react-jsx-runtime-shim.ts"
/*!*************************************************!*\
  !*** ./src/component/react-jsx-runtime-shim.ts ***!
  \*************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Fragment: () => (/* binding */ Fragment),
/* harmony export */   jsx: () => (/* binding */ jsx),
/* harmony export */   jsxDEV: () => (/* binding */ jsxDEV),
/* harmony export */   jsxs: () => (/* binding */ jsxs)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
var __rest = (undefined && undefined.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};

/***************************************************************************
 ** Replacement for react/jsx-runtime and react/jsx-dev-runtime, wired in by
 ** the webpack aliases.
 **
 ** The designer library imports react/jsx-runtime.  Bundling React 18's copy
 ** produces elements that a React 19 host rejects (their $$typeof differs) and
 ** reads React internals that no longer exist.  This shim builds every element
 ** with the host's own React.createElement (the "React" webpack external), so
 ** one bundle works in both the Material (React 18) and the Next (React 19)
 ** dashboards.
 ***************************************************************************/
var Fragment = (react__WEBPACK_IMPORTED_MODULE_0___default().Fragment);
/***************************************************************************
 ** jsx() is used for elements with at most one child.
 ***************************************************************************/
function jsx(type, props, key) {
    var _a = props !== null && props !== void 0 ? props : {}, children = _a.children, rest = __rest(_a, ["children"]);
    if (key !== undefined) {
        rest.key = key;
    }
    return (children === undefined ? react__WEBPACK_IMPORTED_MODULE_0___default().createElement(type, rest) : react__WEBPACK_IMPORTED_MODULE_0___default().createElement(type, rest, children));
}
/***************************************************************************
 ** jsxs() is used for elements with a static list of children; spread them
 ** so that React does not ask for keys.
 ***************************************************************************/
function jsxs(type, props, key) {
    var _a = props !== null && props !== void 0 ? props : {}, children = _a.children, rest = __rest(_a, ["children"]);
    if (key !== undefined) {
        rest.key = key;
    }
    return (react__WEBPACK_IMPORTED_MODULE_0___default().createElement.apply((react__WEBPACK_IMPORTED_MODULE_0___default()), __spreadArray([type, rest], (Array.isArray(children) ? children : [children]), false)));
}
/***************************************************************************
 ** development-mode entry point; the extra arguments are ignored.
 ***************************************************************************/
var jsxDEV = function (type, props, key, isStatic) { return (isStatic ? jsxs : jsx)(type, props, key); };


/***/ },

/***/ "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTExIDE4YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTItOGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTYgNGMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyIDJ6bTAgMmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAgNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6Ii8+Cjwvc3ZnPgo="
/*!**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTExIDE4YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTItOGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTYgNGMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyIDJ6bTAgMmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAgNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6Ii8+Cjwvc3ZnPgo= ***!
  \**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
(module) {

module.exports = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij4KICAgPHBhdGggZD0iTTExIDE4YzAgMS4xLS45IDItMiAycy0yLS45LTItMiAuOS0yIDItMiAyIC45IDIgMnptLTItOGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAtNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTYgNGMxLjEgMCAyLS45IDItMnMtLjktMi0yLTItMiAuOS0yIDIgLjkgMiAyIDJ6bTAgMmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6bTAgNmMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDIgMi0uOSAyLTItLjktMi0yLTJ6Ii8+Cjwvc3ZnPgo=";

/***/ },

/***/ "react"
/*!************************!*\
  !*** external "React" ***!
  \************************/
(module) {

module.exports = __WEBPACK_EXTERNAL_MODULE_react__;

/***/ },

/***/ "react-dom/client"
/*!***************************!*\
  !*** external "ReactDOM" ***!
  \***************************/
(module) {

module.exports = __WEBPACK_EXTERNAL_MODULE_react_dom_client__;

/***/ },

/***/ "./node_modules/dompurify/dist/purify.es.mjs"
/*!***************************************************!*\
  !*** ./node_modules/dompurify/dist/purify.es.mjs ***!
  \***************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ purify_default)
/* harmony export */ });
/*! @license DOMPurify 3.4.17 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.17/LICENSE */
function _OverloadYield(e, d) {
	this.v = e, this.k = d;
}
function _arrayLikeToArray(r, a) {
	(null == a || a > r.length) && (a = r.length);
	for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
	return n;
}
function _arrayWithHoles(r) {
	if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l) {
	var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
	if (null != t) {
		var e, n, i, u, a = [], f = !0, o = !1;
		try {
			if (i = (t = t.call(r)).next, 0 === l) {
				if (Object(t) !== t) return;
				f = !1;
			} else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
		} catch (r) {
			o = !0, n = r;
		} finally {
			try {
				if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
			} finally {
				if (o) throw n;
			}
		}
		return a;
	}
}
function _nonIterableRest() {
	throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
/*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
function _slicedToArray(r, e) {
	return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
	if (r) {
		if ("string" == typeof r) return _arrayLikeToArray(r, a);
		var t = {}.toString.call(r).slice(8, -1);
		return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
	}
}
function AsyncGenerator(e) {
	var t, n;
	function resume(t, n) {
		try {
			var r = e[t](n), o = r.value, u = o instanceof _OverloadYield;
			Promise.resolve(u ? o.v : o).then(function(n) {
				if (u) {
					var i = "return" === t && o.k ? t : "next";
					if (!o.k || n.done) return resume(i, n);
					n = e[i](n).value;
				}
				settle(!!r.done, n);
			}, function(e) {
				resume("throw", e);
			});
		} catch (e) {
			settle(2, e);
		}
	}
	function settle(e, r) {
		2 === e ? t.reject(r) : t.resolve({
			value: r,
			done: e
		}), (t = t.next) ? resume(t.key, t.arg) : n = null;
	}
	this._invoke = function(e, r) {
		return new Promise(function(o, u) {
			var i = {
				key: e,
				arg: r,
				resolve: o,
				reject: u,
				next: null
			};
			n ? n = n.next = i : (t = n = i, resume(e, r));
		});
	}, "function" != typeof e.return && (this.return = void 0);
}
AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
	return this;
}, AsyncGenerator.prototype.next = function(e) {
	return this._invoke("next", e);
}, AsyncGenerator.prototype.throw = function(e) {
	return this._invoke("throw", e);
}, AsyncGenerator.prototype.return = function(e) {
	return this._invoke("return", e);
};
const entries = Object.entries;
const setPrototypeOf = Object.setPrototypeOf;
const isFrozen = Object.isFrozen;
const getPrototypeOf = Object.getPrototypeOf;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
let freeze = Object.freeze;
let seal = Object.seal;
let create = Object.create;
let _ref = typeof Reflect !== "undefined" && Reflect;
let apply = _ref.apply;
let construct = _ref.construct;
if (!freeze) freeze = function freeze(x) {
	return x;
};
if (!seal) seal = function seal(x) {
	return x;
};
if (!apply) apply = function apply(func, thisArg) {
	for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
	return func.apply(thisArg, args);
};
if (!construct) construct = function construct(Func) {
	for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
	return new Func(...args);
};
const arrayForEach = unapply(Array.prototype.forEach);
Array.prototype.indexOf;
const arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
const arrayPop = unapply(Array.prototype.pop);
const arrayPush = unapply(Array.prototype.push);
const arraySlice = unapply(Array.prototype.slice);
const arraySplice = unapply(Array.prototype.splice);
const arrayIsArray = Array.isArray;
const setCreate = unconstruct(Set);
const setAdd = unapply(Set.prototype.add);
const setHas = unapply(Set.prototype.has);
const stringToLowerCase = unapply(String.prototype.toLowerCase);
const stringToString = unapply(String.prototype.toString);
const stringMatch = unapply(String.prototype.match);
const stringReplace = unapply(String.prototype.replace);
const stringIndexOf = unapply(String.prototype.indexOf);
const stringTrim = unapply(String.prototype.trim);
const numberToString = unapply(Number.prototype.toString);
const booleanToString = unapply(Boolean.prototype.toString);
const bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
const symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
const objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
const objectToString = unapply(Object.prototype.toString);
const regExpTest = unapply(RegExp.prototype.test);
const typeErrorCreate = unconstruct(TypeError);
/**
* Creates a new function that calls the given function with a specified thisArg and arguments.
*
* @param func - The function to be wrapped and called.
* @returns A new function that calls the given function with a specified thisArg and arguments.
*/
function unapply(func) {
	return function(thisArg) {
		if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
		for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
		return apply(func, thisArg, args);
	};
}
/**
* Creates a new function that constructs an instance of the given constructor function with the provided arguments.
*
* @param func - The constructor function to be wrapped and called.
* @returns A new function that constructs an instance of the given constructor function with the provided arguments.
*/
function unconstruct(Func) {
	return function() {
		for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
		return construct(Func, args);
	};
}
/**
* Add properties to a lookup table
*
* @param set - The set to which elements will be added.
* @param array - The array containing elements to be added to the set.
* @param transformCaseFunc - An optional function to transform the case of each element before adding to the set.
* @returns The modified set with added elements.
*/
function addToSet(set, array) {
	let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
	if (setPrototypeOf) setPrototypeOf(set, null);
	if (!arrayIsArray(array)) return set;
	let l = array.length;
	while (l--) {
		let element = array[l];
		if (typeof element === "string") {
			const lcElement = transformCaseFunc(element);
			if (lcElement !== element) {
				if (!isFrozen(array)) array[l] = lcElement;
				element = lcElement;
			}
		}
		set[element] = true;
	}
	return set;
}
/**
* Clean up an array to harden against CSPP
*
* @param array - The array to be cleaned.
* @returns The cleaned version of the array
*/
function cleanArray(array) {
	for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
	return array;
}
/**
* Shallow clone an object
*
* @param object - The object to be cloned.
* @returns A new object that copies the original.
*/
function clone(object) {
	const newObject = create(null);
	for (const _ref2 of entries(object)) {
		var _ref3 = _slicedToArray(_ref2, 2);
		const property = _ref3[0];
		const value = _ref3[1];
		if (objectHasOwnProperty(object, property)) {
			if (arrayIsArray(value)) newObject[property] = cleanArray(value);
			else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
			else newObject[property] = value;
		}
	}
	return newObject;
}
/**
* Convert non-node values into strings without depending on direct property access.
*
* @param value - The value to stringify.
* @returns A string representation of the provided value.
*/
function stringifyValue(value) {
	switch (typeof value) {
		case "string": return value;
		case "number": return numberToString(value);
		case "boolean": return booleanToString(value);
		case "bigint": return bigintToString ? bigintToString(value) : "0";
		case "symbol": return symbolToString ? symbolToString(value) : "Symbol()";
		case "undefined": return objectToString(value);
		case "function":
		case "object": {
			if (value === null) return objectToString(value);
			const valueAsRecord = value;
			const valueToString = lookupGetter(valueAsRecord, "toString");
			if (typeof valueToString === "function") {
				const stringified = valueToString(valueAsRecord);
				return typeof stringified === "string" ? stringified : objectToString(stringified);
			}
			return objectToString(value);
		}
		default: return objectToString(value);
	}
}
/**
* This method automatically checks if the prop is function or getter and behaves accordingly.
*
* @param object - The object to look up the getter function in its prototype chain.
* @param prop - The property name for which to find the getter function.
* @returns The getter function found in the prototype chain or a fallback function.
*/
function lookupGetter(object, prop) {
	while (object !== null) {
		const desc = getOwnPropertyDescriptor(object, prop);
		if (desc) {
			if (desc.get) return unapply(desc.get);
			if (typeof desc.value === "function") return unapply(desc.value);
		}
		object = getPrototypeOf(object);
	}
	function fallbackValue() {
		return null;
	}
	return fallbackValue;
}
/**
* Like lookupGetter, but for accessor properties only, and returns null
* instead of a null-returning fallback when no getter exists on the chain.
* Lets a caller fall back to a direct property read in environments that
* lack the getter, where a fallback returning null would be indistinguishable
* from a legitimate null value (e.g. namespaceURI of a no-namespace element).
*
* @param object - The object (usually a prototype) to start the lookup at.
* @param prop - The accessor property name.
* @returns The unapplied getter, or null if none was found.
*/
function lookupAccessor(object, prop) {
	while (object !== null) {
		const desc = getOwnPropertyDescriptor(object, prop);
		if (desc) return desc.get ? unapply(desc.get) : null;
		object = getPrototypeOf(object);
	}
	return null;
}
function isRegex(value) {
	try {
		regExpTest(value, "");
		return true;
	} catch (_unused) {
		return false;
	}
}
const html$1 = freeze([
	"a",
	"abbr",
	"acronym",
	"address",
	"area",
	"article",
	"aside",
	"audio",
	"b",
	"bdi",
	"bdo",
	"big",
	"blink",
	"blockquote",
	"body",
	"br",
	"button",
	"canvas",
	"caption",
	"center",
	"cite",
	"code",
	"col",
	"colgroup",
	"content",
	"data",
	"datalist",
	"dd",
	"decorator",
	"del",
	"details",
	"dfn",
	"dialog",
	"dir",
	"div",
	"dl",
	"dt",
	"element",
	"em",
	"fieldset",
	"figcaption",
	"figure",
	"font",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"head",
	"header",
	"hgroup",
	"hr",
	"html",
	"i",
	"img",
	"input",
	"ins",
	"kbd",
	"label",
	"legend",
	"li",
	"main",
	"map",
	"mark",
	"marquee",
	"menu",
	"menuitem",
	"meter",
	"nav",
	"nobr",
	"ol",
	"optgroup",
	"option",
	"output",
	"p",
	"picture",
	"pre",
	"progress",
	"q",
	"rp",
	"rt",
	"ruby",
	"s",
	"samp",
	"search",
	"section",
	"select",
	"shadow",
	"slot",
	"small",
	"source",
	"spacer",
	"span",
	"strike",
	"strong",
	"style",
	"sub",
	"summary",
	"sup",
	"table",
	"tbody",
	"td",
	"template",
	"textarea",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"track",
	"tt",
	"u",
	"ul",
	"var",
	"video",
	"wbr"
]);
const svg$1 = freeze([
	"svg",
	"a",
	"altglyph",
	"altglyphdef",
	"altglyphitem",
	"animatecolor",
	"animatemotion",
	"animatetransform",
	"circle",
	"clippath",
	"defs",
	"desc",
	"ellipse",
	"enterkeyhint",
	"exportparts",
	"filter",
	"font",
	"g",
	"glyph",
	"glyphref",
	"hkern",
	"image",
	"inputmode",
	"line",
	"lineargradient",
	"marker",
	"mask",
	"metadata",
	"mpath",
	"part",
	"path",
	"pattern",
	"polygon",
	"polyline",
	"radialgradient",
	"rect",
	"stop",
	"style",
	"switch",
	"symbol",
	"text",
	"textpath",
	"title",
	"tref",
	"tspan",
	"view",
	"vkern"
]);
const svgFilters = freeze([
	"feBlend",
	"feColorMatrix",
	"feComponentTransfer",
	"feComposite",
	"feConvolveMatrix",
	"feDiffuseLighting",
	"feDisplacementMap",
	"feDistantLight",
	"feDropShadow",
	"feFlood",
	"feFuncA",
	"feFuncB",
	"feFuncG",
	"feFuncR",
	"feGaussianBlur",
	"feImage",
	"feMerge",
	"feMergeNode",
	"feMorphology",
	"feOffset",
	"fePointLight",
	"feSpecularLighting",
	"feSpotLight",
	"feTile",
	"feTurbulence"
]);
const svgDisallowed = freeze([
	"animate",
	"color-profile",
	"cursor",
	"discard",
	"font-face",
	"font-face-format",
	"font-face-name",
	"font-face-src",
	"font-face-uri",
	"foreignobject",
	"hatch",
	"hatchpath",
	"mesh",
	"meshgradient",
	"meshpatch",
	"meshrow",
	"missing-glyph",
	"script",
	"set",
	"solidcolor",
	"unknown",
	"use"
]);
const mathMl$1 = freeze([
	"math",
	"menclose",
	"merror",
	"mfenced",
	"mfrac",
	"mglyph",
	"mi",
	"mlabeledtr",
	"mmultiscripts",
	"mn",
	"mo",
	"mover",
	"mpadded",
	"mphantom",
	"mroot",
	"mrow",
	"ms",
	"mspace",
	"msqrt",
	"mstyle",
	"msub",
	"msup",
	"msubsup",
	"mtable",
	"mtd",
	"mtext",
	"mtr",
	"munder",
	"munderover",
	"mprescripts"
]);
const mathMlDisallowed = freeze([
	"maction",
	"maligngroup",
	"malignmark",
	"mlongdiv",
	"mscarries",
	"mscarry",
	"msgroup",
	"mstack",
	"msline",
	"msrow",
	"semantics",
	"annotation",
	"annotation-xml",
	"mprescripts",
	"none"
]);
const text = freeze(["#text"]);
const html = freeze([
	"accept",
	"action",
	"align",
	"alt",
	"autocapitalize",
	"autocomplete",
	"autopictureinpicture",
	"autoplay",
	"background",
	"bgcolor",
	"border",
	"capture",
	"cellpadding",
	"cellspacing",
	"checked",
	"cite",
	"class",
	"clear",
	"color",
	"cols",
	"colspan",
	"command",
	"commandfor",
	"controls",
	"controlslist",
	"coords",
	"crossorigin",
	"datetime",
	"decoding",
	"default",
	"dir",
	"disabled",
	"disablepictureinpicture",
	"disableremoteplayback",
	"download",
	"draggable",
	"enctype",
	"enterkeyhint",
	"exportparts",
	"face",
	"for",
	"headers",
	"height",
	"hidden",
	"high",
	"href",
	"hreflang",
	"id",
	"inert",
	"inputmode",
	"integrity",
	"ismap",
	"kind",
	"label",
	"lang",
	"list",
	"loading",
	"loop",
	"low",
	"max",
	"maxlength",
	"media",
	"method",
	"min",
	"minlength",
	"multiple",
	"muted",
	"name",
	"nonce",
	"noshade",
	"novalidate",
	"nowrap",
	"open",
	"optimum",
	"part",
	"pattern",
	"placeholder",
	"playsinline",
	"popover",
	"popovertarget",
	"popovertargetaction",
	"poster",
	"preload",
	"pubdate",
	"radiogroup",
	"readonly",
	"rel",
	"required",
	"rev",
	"reversed",
	"role",
	"rows",
	"rowspan",
	"spellcheck",
	"scope",
	"selected",
	"shape",
	"size",
	"sizes",
	"slot",
	"span",
	"srclang",
	"start",
	"src",
	"srcset",
	"step",
	"style",
	"summary",
	"tabindex",
	"title",
	"translate",
	"type",
	"usemap",
	"valign",
	"value",
	"width",
	"wrap",
	"xmlns"
]);
const svg = freeze([
	"accent-height",
	"accumulate",
	"additive",
	"alignment-baseline",
	"amplitude",
	"ascent",
	"attributename",
	"attributetype",
	"azimuth",
	"basefrequency",
	"baseline-shift",
	"begin",
	"bias",
	"by",
	"class",
	"clip",
	"clippathunits",
	"clip-path",
	"clip-rule",
	"color",
	"color-interpolation",
	"color-interpolation-filters",
	"color-profile",
	"color-rendering",
	"cx",
	"cy",
	"d",
	"dx",
	"dy",
	"diffuseconstant",
	"direction",
	"display",
	"divisor",
	"dominant-baseline",
	"dur",
	"edgemode",
	"elevation",
	"end",
	"exponent",
	"fill",
	"fill-opacity",
	"fill-rule",
	"filter",
	"filterunits",
	"flood-color",
	"flood-opacity",
	"font-family",
	"font-size",
	"font-size-adjust",
	"font-stretch",
	"font-style",
	"font-variant",
	"font-weight",
	"fx",
	"fy",
	"g1",
	"g2",
	"glyph-name",
	"glyphref",
	"gradientunits",
	"gradienttransform",
	"height",
	"href",
	"id",
	"image-rendering",
	"in",
	"in2",
	"intercept",
	"k",
	"k1",
	"k2",
	"k3",
	"k4",
	"kerning",
	"keypoints",
	"keysplines",
	"keytimes",
	"lang",
	"lengthadjust",
	"letter-spacing",
	"kernelmatrix",
	"kernelunitlength",
	"lighting-color",
	"local",
	"marker-end",
	"marker-mid",
	"marker-start",
	"markerheight",
	"markerunits",
	"markerwidth",
	"maskcontentunits",
	"maskunits",
	"max",
	"mask",
	"mask-type",
	"media",
	"method",
	"mode",
	"min",
	"name",
	"numoctaves",
	"offset",
	"operator",
	"opacity",
	"order",
	"orient",
	"orientation",
	"origin",
	"overflow",
	"paint-order",
	"path",
	"pathlength",
	"patterncontentunits",
	"patterntransform",
	"patternunits",
	"pointer-events",
	"points",
	"preservealpha",
	"preserveaspectratio",
	"primitiveunits",
	"r",
	"rx",
	"ry",
	"radius",
	"refx",
	"refy",
	"repeatcount",
	"repeatdur",
	"restart",
	"result",
	"rotate",
	"scale",
	"seed",
	"shape-rendering",
	"slope",
	"specularconstant",
	"specularexponent",
	"spreadmethod",
	"startoffset",
	"stddeviation",
	"stitchtiles",
	"stop-color",
	"stop-opacity",
	"stroke-dasharray",
	"stroke-dashoffset",
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-miterlimit",
	"stroke-opacity",
	"stroke",
	"stroke-width",
	"style",
	"surfacescale",
	"systemlanguage",
	"tabindex",
	"tablevalues",
	"targetx",
	"targety",
	"transform",
	"transform-origin",
	"text-anchor",
	"text-decoration",
	"text-orientation",
	"text-rendering",
	"textlength",
	"type",
	"u1",
	"u2",
	"unicode",
	"values",
	"vector-effect",
	"viewbox",
	"visibility",
	"version",
	"vert-adv-y",
	"vert-origin-x",
	"vert-origin-y",
	"width",
	"word-spacing",
	"wrap",
	"writing-mode",
	"xchannelselector",
	"ychannelselector",
	"x",
	"x1",
	"x2",
	"xmlns",
	"y",
	"y1",
	"y2",
	"z",
	"zoomandpan"
]);
const mathMl = freeze([
	"accent",
	"accentunder",
	"align",
	"bevelled",
	"close",
	"columnalign",
	"columnlines",
	"columnspacing",
	"columnspan",
	"denomalign",
	"depth",
	"dir",
	"display",
	"displaystyle",
	"encoding",
	"fence",
	"frame",
	"height",
	"href",
	"id",
	"largeop",
	"length",
	"linethickness",
	"lquote",
	"lspace",
	"mathbackground",
	"mathcolor",
	"mathsize",
	"mathvariant",
	"maxsize",
	"minsize",
	"movablelimits",
	"notation",
	"numalign",
	"open",
	"rowalign",
	"rowlines",
	"rowspacing",
	"rowspan",
	"rspace",
	"rquote",
	"scriptlevel",
	"scriptminsize",
	"scriptsizemultiplier",
	"selection",
	"separator",
	"separators",
	"stretchy",
	"subscriptshift",
	"supscriptshift",
	"symmetric",
	"voffset",
	"width",
	"xmlns"
]);
const xml = freeze([
	"xlink:href",
	"xml:id",
	"xlink:title",
	"xml:space",
	"xmlns:xlink"
]);
const MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
const ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
const TMPLIT_EXPR = seal(/\${[\w\W]*/g);
const DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
const ARIA_ATTR = seal(/^aria-[\-\w]+$/);
const IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
const IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
const ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
const DOCTYPE_NAME = seal(/^html$/i);
const CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
const ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
const COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
const FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
const SELF_CLOSING_TAG = seal(/\/>/i);
const NODE_TYPE = {
	element: 1,
	attribute: 2,
	text: 3,
	cdataSection: 4,
	entityReference: 5,
	entityNode: 6,
	processingInstruction: 7,
	comment: 8,
	document: 9,
	documentType: 10,
	documentFragment: 11,
	notation: 12
};
const LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, [
	"style",
	"script",
	"xmp",
	"iframe",
	"noembed",
	"noframes",
	"plaintext",
	"noscript"
]));
const getGlobal = function getGlobal() {
	return typeof window === "undefined" ? null : window;
};
/**
* Creates a no-op policy for internal use only.
* Don't export this function outside this module!
* @param trustedTypes The policy factory.
* @param purifyHostElement The Script element used to load DOMPurify (to determine policy name suffix).
* @return The policy created (or null, if Trusted Types
* are not supported or creating the policy failed).
*/
const _createTrustedTypesPolicy = function _createTrustedTypesPolicy(trustedTypes, purifyHostElement) {
	if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
	let suffix = null;
	const ATTR_NAME = "data-tt-policy-suffix";
	if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
	const policyName = "dompurify" + (suffix ? "#" + suffix : "");
	try {
		return trustedTypes.createPolicy(policyName, {
			createHTML(html) {
				return html;
			},
			createScriptURL(scriptUrl) {
				return scriptUrl;
			}
		});
	} catch (_) {
		console.warn("TrustedTypes policy " + policyName + " could not be created.");
		return null;
	}
};
const _createHooksMap = function _createHooksMap() {
	return {
		afterSanitizeAttributes: [],
		afterSanitizeElements: [],
		afterSanitizeShadowDOM: [],
		beforeSanitizeAttributes: [],
		beforeSanitizeElements: [],
		beforeSanitizeShadowDOM: [],
		uponSanitizeAttribute: [],
		uponSanitizeElement: [],
		uponSanitizeShadowNode: []
	};
};
/**
* Resolve a set-valued configuration option: a fresh set built from
* cfg[key] when it is an own array property (seeded with a clone of
* options.base when given, case-normalized via options.transform),
* the fallback set otherwise.
*
* @param cfg the cloned, prototype-free configuration object
* @param key the configuration property to read
* @param fallback the set to use when the option is absent or not an array
* @param options transform and optional base set to merge into
* @returns the resolved set
*/
const _resolveSetOption = function _resolveSetOption(cfg, key, fallback, options) {
	return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
};
/**
* Resolve an object-valued configuration option: a prototype-free clone
* of cfg[key] when it is an own, truthy object property, else a fresh
* fallback built by makeFallback (fresh on every parse, so a previous
* parse can never leak state into the next one).
*
* @param cfg the cloned, prototype-free configuration object
* @param key the configuration property to read
* @param makeFallback builds the fallback value when the option is absent
* @returns the resolved object
*/
const _resolveObjectOption = function _resolveObjectOption(cfg, key, makeFallback) {
	const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
	return value && typeof value === "object" ? clone(value) : makeFallback();
};
function createDOMPurify() {
	let window = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
	const DOMPurify = (root) => createDOMPurify(root);
	DOMPurify.version = "3.4.17";
	DOMPurify.removed = [];
	if (!window || !window.document || window.document.nodeType !== NODE_TYPE.document || !window.Element) {
		DOMPurify.isSupported = false;
		return DOMPurify;
	}
	let document = window.document;
	const originalDocument = document;
	const currentScript = originalDocument.currentScript;
	window.DocumentFragment;
	const HTMLTemplateElement = window.HTMLTemplateElement, Node = window.Node, Element = window.Element, NodeFilter = window.NodeFilter;
	window.NamedNodeMap === void 0 && (window.NamedNodeMap || window.MozNamedAttrMap);
	window.HTMLFormElement;
	const DOMParser = window.DOMParser, trustedTypes = window.trustedTypes;
	const ElementPrototype = Element.prototype;
	const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
	const remove = lookupGetter(ElementPrototype, "remove");
	const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
	const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
	const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
	const getParentNode = lookupGetter(ElementPrototype, "parentNode");
	const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
	const getAttributes = lookupGetter(ElementPrototype, "attributes");
	const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
	const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
	const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
	const _readNodeType = function _readNodeType(node) {
		return getNodeType ? getNodeType(node) : node.nodeType;
	};
	const _readNodeName = function _readNodeName(node) {
		return getNodeName ? getNodeName(node) : node.nodeName;
	};
	const getNamespaceURI = lookupAccessor(ElementPrototype, "namespaceURI");
	const _readNamespaceURI = function _readNamespaceURI(element) {
		return getNamespaceURI ? getNamespaceURI(element) : element.namespaceURI;
	};
	if (typeof HTMLTemplateElement === "function") {
		const template = document.createElement("template");
		if (template.content && template.content.ownerDocument) document = template.content.ownerDocument;
	}
	let trustedTypesPolicy;
	let emptyHTML = "";
	let defaultTrustedTypesPolicy;
	let defaultTrustedTypesPolicyResolved = false;
	let IN_TRUSTED_TYPES_POLICY = 0;
	const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy() {
		if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate("A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the \"DOMPurify and Trusted Types\" section of the README.");
	};
	const _createTrustedHTML = function _createTrustedHTML(html) {
		_assertNotInTrustedTypesPolicy();
		IN_TRUSTED_TYPES_POLICY++;
		try {
			return trustedTypesPolicy.createHTML(html);
		} finally {
			IN_TRUSTED_TYPES_POLICY--;
		}
	};
	const _createTrustedScriptURL = function _createTrustedScriptURL(scriptUrl) {
		_assertNotInTrustedTypesPolicy();
		IN_TRUSTED_TYPES_POLICY++;
		try {
			return trustedTypesPolicy.createScriptURL(scriptUrl);
		} finally {
			IN_TRUSTED_TYPES_POLICY--;
		}
	};
	const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy() {
		if (!defaultTrustedTypesPolicyResolved) {
			defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
			defaultTrustedTypesPolicyResolved = true;
		}
		return defaultTrustedTypesPolicy;
	};
	const _document = document, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
	const importNode = originalDocument.importNode;
	let hooks = _createHooksMap();
	/**
	* Expose whether this browser supports running the full DOMPurify.
	*/
	DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
	const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
	let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
	/**
	* We consider the elements and attributes below to be safe. Ideally
	* don't add any new ones but feel free to remove unwanted ones.
	*/
	let ALLOWED_TAGS = null;
	const DEFAULT_ALLOWED_TAGS = addToSet({}, [
		...html$1,
		...svg$1,
		...svgFilters,
		...mathMl$1,
		...text
	]);
	let ALLOWED_ATTR = null;
	const DEFAULT_ALLOWED_ATTR = addToSet({}, [
		...html,
		...svg,
		...mathMl,
		...xml
	]);
	let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
		tagNameCheck: {
			writable: true,
			configurable: false,
			enumerable: true,
			value: null
		},
		attributeNameCheck: {
			writable: true,
			configurable: false,
			enumerable: true,
			value: null
		},
		allowCustomizedBuiltInElements: {
			writable: true,
			configurable: false,
			enumerable: true,
			value: false
		}
	}));
	let FORBID_TAGS = null;
	let FORBID_ATTR = null;
	const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
		tagCheck: {
			writable: true,
			configurable: false,
			enumerable: true,
			value: null
		},
		attributeCheck: {
			writable: true,
			configurable: false,
			enumerable: true,
			value: null
		}
	}));
	let ALLOW_ARIA_ATTR = true;
	let ALLOW_DATA_ATTR = true;
	let ALLOW_UNKNOWN_PROTOCOLS = false;
	let ALLOW_SELF_CLOSE_IN_ATTR = true;
	let SAFE_FOR_TEMPLATES = false;
	let SAFE_FOR_XML = true;
	let WHOLE_DOCUMENT = false;
	let SET_CONFIG = false;
	let SET_CONFIG_ALLOWED_TAGS = null;
	let SET_CONFIG_ALLOWED_ATTR = null;
	let FORCE_BODY = false;
	let RETURN_DOM = false;
	let RETURN_DOM_FRAGMENT = false;
	let RETURN_TRUSTED_TYPE = false;
	let SANITIZE_DOM = true;
	let SANITIZE_NAMED_PROPS = false;
	const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
	let KEEP_CONTENT = true;
	let IN_PLACE = false;
	let IN_PLACE_VISITED = null;
	let USE_PROFILES = {};
	let FORBID_CONTENTS = null;
	const DEFAULT_FORBID_CONTENTS = addToSet({}, [
		"annotation-xml",
		"audio",
		"colgroup",
		"desc",
		"foreignobject",
		"head",
		"iframe",
		"math",
		"mi",
		"mn",
		"mo",
		"ms",
		"mtext",
		"noembed",
		"noframes",
		"noscript",
		"plaintext",
		"script",
		"selectedcontent",
		"style",
		"svg",
		"template",
		"thead",
		"title",
		"video",
		"xmp"
	]);
	let DATA_URI_TAGS = null;
	const DEFAULT_DATA_URI_TAGS = addToSet({}, [
		"audio",
		"video",
		"img",
		"source",
		"image",
		"track"
	]);
	let URI_SAFE_ATTRIBUTES = null;
	const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
		"alt",
		"class",
		"for",
		"id",
		"label",
		"name",
		"pattern",
		"placeholder",
		"role",
		"summary",
		"title",
		"value",
		"style",
		"xmlns"
	]);
	const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
	const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
	const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
	let NAMESPACE = HTML_NAMESPACE;
	let IS_EMPTY_INPUT = false;
	let ALLOWED_NAMESPACES = null;
	const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
		MATHML_NAMESPACE,
		SVG_NAMESPACE,
		HTML_NAMESPACE
	], stringToString);
	const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
		"mi",
		"mo",
		"mn",
		"ms",
		"mtext"
	]);
	let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
	const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
	let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
	const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
		"title",
		"style",
		"font",
		"a",
		"script"
	]);
	let PARSER_MEDIA_TYPE = null;
	const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
	const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
	let transformCaseFunc = null;
	let CONFIG = null;
	const formElement = document.createElement("form");
	const isRegexOrFunction = function isRegexOrFunction(testValue) {
		return testValue instanceof RegExp || testValue instanceof Function;
	};
	/**
	* _parseConfig
	*
	* @param cfg optional config literal
	*/
	const _parseConfig = function _parseConfig() {
		let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		if (CONFIG && CONFIG === cfg) return;
		if (!cfg || typeof cfg !== "object") cfg = {};
		cfg = clone(cfg);
		PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
		transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
		ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
		ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
		ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
		URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
			transform: transformCaseFunc,
			base: DEFAULT_URI_SAFE_ATTRIBUTES
		});
		DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
			transform: transformCaseFunc,
			base: DEFAULT_DATA_URI_TAGS
		});
		FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
		FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
		FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
		USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
		ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
		ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
		ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
		ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
		SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
		SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
		WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
		RETURN_DOM = cfg.RETURN_DOM || false;
		RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
		RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
		FORCE_BODY = cfg.FORCE_BODY || false;
		SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
		SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
		KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
		IN_PLACE = cfg.IN_PLACE || false;
		IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
		NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
		MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
		HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
		const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
		CUSTOM_ELEMENT_HANDLING = create(null);
		if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
		if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
		if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
		seal(CUSTOM_ELEMENT_HANDLING);
		if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
		if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
		if (USE_PROFILES) {
			ALLOWED_TAGS = addToSet({}, text);
			ALLOWED_ATTR = create(null);
			if (USE_PROFILES.html === true) {
				addToSet(ALLOWED_TAGS, html$1);
				addToSet(ALLOWED_ATTR, html);
			}
			if (USE_PROFILES.svg === true) {
				addToSet(ALLOWED_TAGS, svg$1);
				addToSet(ALLOWED_ATTR, svg);
				addToSet(ALLOWED_ATTR, xml);
			}
			if (USE_PROFILES.svgFilters === true) {
				addToSet(ALLOWED_TAGS, svgFilters);
				addToSet(ALLOWED_ATTR, svg);
				addToSet(ALLOWED_ATTR, xml);
			}
			if (USE_PROFILES.mathMl === true) {
				addToSet(ALLOWED_TAGS, mathMl$1);
				addToSet(ALLOWED_ATTR, mathMl);
				addToSet(ALLOWED_ATTR, xml);
			}
		}
		EXTRA_ELEMENT_HANDLING.tagCheck = null;
		EXTRA_ELEMENT_HANDLING.attributeCheck = null;
		if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
			if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
			else if (arrayIsArray(cfg.ADD_TAGS)) {
				if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
				addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
			}
		}
		if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
			if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
			else if (arrayIsArray(cfg.ADD_ATTR)) {
				if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
				addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
			}
		}
		if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
			if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
			addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
		}
		if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
		if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
			"html",
			"head",
			"body"
		]);
		if (ALLOWED_TAGS.table) {
			addToSet(ALLOWED_TAGS, ["tbody"]);
			delete FORBID_TAGS.tbody;
		}
		if (cfg.TRUSTED_TYPES_POLICY) {
			if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createHTML\" hook.");
			if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate("TRUSTED_TYPES_POLICY configuration option must provide a \"createScriptURL\" hook.");
			const previousTrustedTypesPolicy = trustedTypesPolicy;
			trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
			try {
				emptyHTML = _createTrustedHTML("");
			} catch (error) {
				trustedTypesPolicy = previousTrustedTypesPolicy;
				throw error;
			}
		} else if (cfg.TRUSTED_TYPES_POLICY === null) {
			trustedTypesPolicy = void 0;
			emptyHTML = "";
		} else {
			if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
			if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
		}
		if (freeze) freeze(cfg);
		CONFIG = cfg;
	};
	const ALL_SVG_TAGS = addToSet({}, [
		...svg$1,
		...svgFilters,
		...svgDisallowed
	]);
	const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
	/**
	* Namespace rules for an element in the SVG namespace.
	*
	* @param tagName the element's lowercase tag name
	* @param parent the (possibly simulated) parent node
	* @param parentTagName the parent's lowercase tag name
	* @returns true if a spec-compliant parser could produce this element
	*/
	const _checkSvgNamespace = function _checkSvgNamespace(tagName, parent, parentTagName) {
		if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
		if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
		return Boolean(ALL_SVG_TAGS[tagName]);
	};
	/**
	* Namespace rules for an element in the MathML namespace.
	*
	* @param tagName the element's lowercase tag name
	* @param parent the (possibly simulated) parent node
	* @param parentTagName the parent's lowercase tag name
	* @returns true if a spec-compliant parser could produce this element
	*/
	const _checkMathMlNamespace = function _checkMathMlNamespace(tagName, parent, parentTagName) {
		if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
		if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
		return Boolean(ALL_MATHML_TAGS[tagName]);
	};
	/**
	* Namespace rules for an element in the HTML namespace.
	*
	* @param tagName the element's lowercase tag name
	* @param parent the (possibly simulated) parent node
	* @param parentTagName the parent's lowercase tag name
	* @returns true if a spec-compliant parser could produce this element
	*/
	const _checkHtmlNamespace = function _checkHtmlNamespace(tagName, parent, parentTagName) {
		if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
		if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
		return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
	};
	/**
	* @param element a DOM element whose namespace is being checked
	* @returns Return false if the element has a
	*  namespace that a spec-compliant parser would never
	*  return. Return true otherwise.
	*/
	const _checkValidNamespace = function _checkValidNamespace(element) {
		const elementNamespace = _readNamespaceURI(element);
		const tagName = stringToLowerCase(_readNodeName(element));
		const parentNode = getParentNode(element);
		let parent;
		let parentTagName;
		if (parentNode && _readNodeType(parentNode) === NODE_TYPE.element) {
			parent = { namespaceURI: _readNamespaceURI(parentNode) };
			parentTagName = stringToLowerCase(_readNodeName(parentNode));
		} else {
			parent = { namespaceURI: NAMESPACE };
			parentTagName = "template";
		}
		if (!ALLOWED_NAMESPACES[elementNamespace]) return false;
		if (elementNamespace === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
		if (elementNamespace === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
		if (elementNamespace === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
		if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[elementNamespace]) return true;
		return false;
	};
	/**
	* _forceRemove
	*
	* @param node a DOM node
	*/
	const _forceRemove = function _forceRemove(node) {
		arrayPush(DOMPurify.removed, { element: node });
		try {
			getParentNode(node).removeChild(node);
		} catch (_) {
			remove(node);
			if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
		}
	};
	/**
	* _stripAttributeNode
	*
	* Remove a single Attr node case/namespace-exactly on an attribute-teardown
	* path. Name-based removeAttribute() ASCII-lowercases its lookup key for an
	* HTML element in an HTML document and so silently misses a case-preserved
	* handler (e.g. `ONERROR` off an XML/XHTML import) - the same defect
	* _removeAttribute() was fixed for, which a name-based call would reintroduce
	* on these IN_PLACE teardown paths. Unlike _removeAttribute this does not
	* record into DOMPurify.removed: the neutralize passes intentionally do not
	* book-keep. A clobbered/detached node falls back to best-effort name-based
	* removal.
	*
	* @param element the element to strip the attribute from
	* @param attribute the Attr node to remove
	* @param name the attribute's name, for the fallback path
	*/
	const _stripAttributeNode = function _stripAttributeNode(element, attribute, name) {
		try {
			removeAttributeNode(element, attribute);
		} catch (_) {
			try {
				element.removeAttribute(name);
			} catch (_) {}
		}
	};
	/**
	* Fail-closed teardown of an in-place root: strip every disallowed attribute
	* in the subtree first, so nothing armed is left behind, then remove all
	* children and the root's own attributes.
	*
	* @param root the in-place root to empty
	*/
	const _neutralizeRoot = function _neutralizeRoot(root) {
		_neutralizeSubtree(root);
		const childNodes = getChildNodes(root);
		if (childNodes) arrayForEach(arraySlice(childNodes), (child) => {
			try {
				remove(child);
			} catch (_) {}
		});
		const attributes = _readNodeType(root) === NODE_TYPE.element ? getAttributes(root) : null;
		if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
			const attribute = attributes[i];
			const name = attribute && attribute.name;
			if (typeof name === "string") _stripAttributeNode(root, attribute, name);
		}
	};
	/**
	* Removes an attribute, preferably as its exact Attr node: name-based
	* removal lowercases the name in HTML documents and misses case-preserved
	* names, e.g. from imported XHTML.
	*
	* @param name an Attribute name
	* @param element a DOM node
	* @param attr the exact Attr node to remove, when the caller has it
	*/
	const _removeAttribute = function _removeAttribute(name, element, attr) {
		if (!attr) try {
			attr = element.getAttributeNode(name);
		} catch (_) {
			attr = null;
		}
		arrayPush(DOMPurify.removed, {
			attribute: attr || null,
			from: element
		});
		try {
			if (attr) removeAttributeNode(element, attr);
			else element.removeAttribute(name);
		} catch (_) {
			try {
				element.removeAttribute(name);
			} catch (_) {}
		}
		if (name === "is") {
			if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
				_forceRemove(element);
			} catch (_) {}
			else try {
				element.setAttribute(name, "");
			} catch (_) {}
		}
	};
	/**
	* Removes every attribute the configuration does not allow. Used to
	* neutralize nodes discarded from an in-place tree.
	*
	* @param element the element to strip
	*/
	const _stripDisallowedAttributes = function _stripDisallowedAttributes(element) {
		const attributes = getAttributes(element);
		if (!attributes) return;
		for (let i = attributes.length - 1; i >= 0; --i) {
			const attribute = attributes[i];
			const name = attribute && attribute.name;
			if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
			_stripAttributeNode(element, attribute, name);
		}
	};
	/**
	* Iterative depth-first walk, so deep trees cannot overflow the call stack,
	* reading through the cached getters, so clobbering cannot hide children.
	* When `visit` returns false, the node's children are skipped. With
	* `intoShadow`, open shadow roots are walked after their host's children.
	*
	* @param root where to start
	* @param visit called for every node
	* @param intoShadow whether to enter open shadow roots
	*/
	const _walkTree = function _walkTree(root, visit) {
		let intoShadow = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
		const stack = [root];
		while (stack.length > 0) {
			const node = stack.pop();
			if (visit(node) === false) continue;
			if (intoShadow && _readNodeType(node) === NODE_TYPE.element) {
				const shadowRoot = getShadowRoot(node);
				if (_isDocumentFragment(shadowRoot)) stack.push(shadowRoot);
			}
			const childNodes = getChildNodes(node);
			if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
		}
	};
	/**
	* Strips disallowed attributes from every element of a discarded subtree,
	* so a handler that is already queued (a loading image) cannot fire.
	*
	* @param root the root of a removed subtree
	*/
	const _neutralizeSubtree = function _neutralizeSubtree(root) {
		_walkTree(root, (node) => {
			if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
		});
	};
	/**
	* All nodes under `root`, root first, including open shadow roots. Template
	* content is not entered, it is inert.
	*
	* @param root the in-place root
	* @return the nodes
	*/
	const _collectLiveNodes = function _collectLiveNodes(root) {
		const nodes = [];
		_walkTree(root, (node) => {
			nodes.push(node);
		}, true);
		return nodes;
	};
	/**
	* Strips disallowed attributes from every element that was under the
	* in-place root when the call started and no longer is, whatever removed
	* or moved it.
	*
	* @param root the in-place root
	* @param before the root's nodes, collected before the walk
	*/
	const _neutralizeEscapedElements = function _neutralizeEscapedElements(root, before) {
		const reachable = setCreate();
		arrayForEach(_collectLiveNodes(root), (node) => {
			if (_readNodeType(node) === NODE_TYPE.element) setAdd(reachable, node);
		});
		arrayForEach(before, (node) => {
			if (_readNodeType(node) === NODE_TYPE.element && !setHas(reachable, node)) _stripDisallowedAttributes(node);
		});
	};
	/**
	* Neutralizes everything that left the in-place tree during the call: what
	* DOMPurify removed, and what hooks or custom elements removed or moved out.
	*
	* @param root the in-place root
	* @param before the root's nodes, collected before the walk
	* @return true if the root itself was removed
	*/
	const _neutralizeDiscarded = function _neutralizeDiscarded(root, before) {
		let rootRemoved = false;
		arrayForEach(DOMPurify.removed, (entry) => {
			if (entry.element) {
				rootRemoved = rootRemoved || entry.element === root;
				_neutralizeSubtree(entry.element);
			}
		});
		_neutralizeEscapedElements(root, before);
		return rootRemoved;
	};
	const MAX_UNVISITED_ROUNDS = 8;
	/**
	* The walk only moves forward, so a node moved to a position it already
	* passed is never visited. Give every original node that is still in the
	* tree but unvisited the normal treatment, hooks included. Nodes created
	* during the call are left alone. Fails closed if the tree keeps changing.
	*
	* @param root the in-place root
	* @param before the root's nodes, collected before the walk
	*/
	const _sanitizeUnvisitedNodes = function _sanitizeUnvisitedNodes(root, before) {
		const visited = IN_PLACE_VISITED;
		let original = null;
		const getOriginal = () => {
			if (!original) {
				original = setCreate();
				arrayForEach(before, (beforeNode) => {
					setAdd(original, beforeNode);
				});
			}
			return original;
		};
		for (let round = 0;; round++) {
			const live = _collectLiveNodes(root);
			const containers = [root];
			let pending = false;
			arrayForEach(live, (node) => {
				if (_readNodeType(node) === NODE_TYPE.documentFragment) arrayPush(containers, node);
				else if (!pending && !setHas(visited, node)) pending = setHas(getOriginal(), node);
			});
			if (!pending) return;
			if (round >= MAX_UNVISITED_ROUNDS) throw typeErrorCreate("the tree kept changing during in-place sanitization; refusing to return it");
			arrayForEach(containers, (container, index) => {
				_sanitizeUnvisitedIn(container, index > 0, root, getOriginal());
			});
		}
	};
	/**
	* One _sanitizeUnvisitedNodes pass over the root or an open shadow root.
	*
	* @param container the root or an open shadow root
	* @param inShadow whether container is a shadow root
	* @param root the in-place root
	* @param original the root's nodes collected before the walk, as a set
	*/
	const _sanitizeUnvisitedIn = function _sanitizeUnvisitedIn(container, inShadow, root, original) {
		const iterator = _createNodeIterator(container);
		let node;
		while (node = iterator.nextNode()) {
			if (!setHas(original, node) || setHas(IN_PLACE_VISITED, node)) continue;
			if (inShadow) _executeHooks(hooks.uponSanitizeShadowNode, node, null);
			_sanitizeElements(node, root);
			_sanitizeAttributes(node, root);
			if (_isDocumentFragment(node.content)) _sanitizeShadowDOM2(node.content);
		}
	};
	/**
	* Records that _sanitizeElements processed `node`. No-op outside IN_PLACE.
	*
	* @param node the node being processed
	*/
	const _markVisited = function _markVisited(node) {
		if (IN_PLACE_VISITED) setAdd(IN_PLACE_VISITED, node);
	};
	/**
	* Patch-linkage attributes (declarative partial updates): `patchsrc`
	* always, `for` everywhere except on <label> and <output>. Gated on
	* SAFE_FOR_XML. Shared by the IN_PLACE pre-pass and _isValidAttribute.
	*
	* @param lcName the transformCaseFunc'd attribute name
	* @param lcTag the transformCaseFunc'd tag name of the carrying element
	* @return true if the attribute is patch linkage and must be dropped
	*/
	const _isPatchLinkageAttribute = function _isPatchLinkageAttribute(lcName, lcTag) {
		if (!SAFE_FOR_XML) return false;
		if (lcName === "patchsrc") return true;
		return lcName === "for" && lcTag !== "label" && lcTag !== "output";
	};
	/**
	* IN_PLACE pre-pass: sever all patch linkage before the walk, so no patch
	* can fire mid-walk into a part of the tree the walker already passed.
	* Removes range markers (processing instructions, comments with markup)
	* and strips linkage attributes. It cannot undo a patch that already fired.
	*
	* TODO: if the shipped feature can patch through `for` on <label>/<output>,
	* drop that pair here too (see test/declarative-patch-probe.html).
	*
	* @param root the in-place root to sweep
	*/
	const _neutralizePatchLinkage = function _neutralizePatchLinkage(root) {
		if (!SAFE_FOR_XML) return;
		_walkTree(root, (node) => {
			const nodeType = _readNodeType(node);
			if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
				try {
					remove(node);
				} catch (_) {}
				return false;
			}
			if (nodeType === NODE_TYPE.element) {
				const element = node;
				const lcTag = transformCaseFunc(_readNodeName(node));
				try {
					if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
					if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
				} catch (_) {}
			}
			return true;
		});
	};
	/**
	* _initDocument
	*
	* @param dirty - a string of dirty markup
	* @return a DOM, filled with the dirty markup
	*/
	const _initDocument = function _initDocument(dirty) {
		let doc = null;
		let leadingWhitespace = null;
		if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
		else {
			const matches = stringMatch(dirty, /^[\r\n\t ]+/);
			leadingWhitespace = matches && matches[0];
		}
		if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>" + dirty + "</body></html>";
		const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
		if (NAMESPACE === HTML_NAMESPACE) try {
			doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
		} catch (_) {}
		if (!doc || !doc.documentElement) {
			doc = implementation.createDocument(NAMESPACE, "template", null);
			try {
				doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
			} catch (_) {}
		}
		const body = doc.body || doc.documentElement;
		if (dirty && leadingWhitespace) body.insertBefore(document.createTextNode(leadingWhitespace), body.childNodes[0] || null);
		if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
		return WHOLE_DOCUMENT ? doc.documentElement : body;
	};
	/**
	* Creates a NodeIterator object that you can use to traverse filtered lists of nodes or elements in a document.
	*
	* @param root The root element or node to start traversing on.
	* @return The created NodeIterator
	*/
	const _createNodeIterator = function _createNodeIterator(root) {
		const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
		return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
	};
	/**
	* Replace template expression syntax (mustache, ERB, template
	* literal) with a space; shared by all SAFE_FOR_TEMPLATES scrub
	* sites. Order matters: mustache, then ERB, then template literal.
	*
	* @param value the string to scrub
	* @returns the scrubbed string
	*/
	const _stripTemplateExpressions = function _stripTemplateExpressions(value) {
		value = stringReplace(value, MUSTACHE_EXPR$1, " ");
		value = stringReplace(value, ERB_EXPR$1, " ");
		value = stringReplace(value, TMPLIT_EXPR$1, " ");
		return value;
	};
	/**
	* Strip template-engine expressions ({{...}}, ${...}, <%...%>) from the
	* character data of an element subtree. Used as the final safety net for
	* SAFE_FOR_TEMPLATES on every DOM-returning code path so that expressions
	* which only form after text-node normalization (e.g. fragments split across
	* stripped elements) cannot survive into a template-evaluating framework.
	*
	* Walks text/comment/CDATA/processing-instruction nodes and mutates `.data`
	* in place rather than round-tripping through innerHTML. This preserves
	* descendant node references (important for IN_PLACE callers), avoids a
	* serialize/reparse cycle, and reads literal character data — which means
	* `<%...%>` in text content matches the ERB regex against its real bytes
	* instead of the HTML-entity-escaped form innerHTML would produce.
	*
	* Attribute values are not visited here; SAFE_FOR_TEMPLATES handling for
	* attributes is performed during the per-node `_sanitizeAttributes` pass.
	*
	* @param node The root element whose character data should be scrubbed.
	*/
	const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
		var _node$querySelectorAl;
		_scrubOwnCharacterData(node);
		const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
		if (templates) arrayForEach(templates, (tmpl) => {
			if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
		});
	};
	/**
	* _scrubOwnCharacterData
	*
	* Non-recursive core of _scrubTemplateExpressions: normalize `node` and
	* strip template expressions from its own character data only. Does not
	* enter <template>.content or attached shadow roots (NodeIterator never
	* does). Used by _sanitizeShadowDOM, where every nested template content
	* and shadow root is already walked - and therefore scrubbed - by its own
	* recursive _sanitizeShadowDOM call; recursing here as well would rescrub
	* each nested fragment once per ancestor, which is quadratic in nesting
	* depth.
	*
	* @param node The root whose own character data should be scrubbed.
	*/
	const _scrubOwnCharacterData = function _scrubOwnCharacterData(node) {
		node.normalize();
		const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
		const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
		let currentNode = walker.nextNode();
		while (currentNode) {
			currentNode.data = _stripTemplateExpressions(currentNode.data);
			currentNode = walker.nextNode();
		}
	};
	/**
	* _isClobbered
	*
	* Detect DOM-clobbering on HTMLFormElement nodes. Form is the only HTML
	* interface with [LegacyOverrideBuiltIns]; a descendant element with a
	* `name` attribute matching a prototype property shadows that property
	* on direct reads. We use this check at the IN_PLACE entry-point and
	* during attribute sanitization to refuse clobbered forms.
	*
	* @param element element to check for clobbering attacks
	* @return true if clobbered, false if safe
	*/
	const _isClobbered = function _isClobbered(element) {
		const realTagName = getNodeName ? getNodeName(element) : null;
		if (typeof realTagName !== "string") return false;
		if (transformCaseFunc(realTagName) !== "form") return false;
		return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.removeAttributeNode !== "function" || typeof element.getAttributeNode !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
	};
	/**
	* Checks whether the given value is a DocumentFragment from any realm.
	*
	* The realm-independent replacement reads `nodeType` through the cached
	* Node.prototype getter and compares to the DOCUMENT_FRAGMENT_NODE
	* constant (11). nodeType is a numeric value resolved from the node's
	* internal slot, identical across realms for the same kind of node.
	*
	* @param value object to check
	* @return true if value is a DocumentFragment-shaped node from any realm
	*/
	const _isDocumentFragment = function _isDocumentFragment(value) {
		if (!getNodeType || typeof value !== "object" || value === null) return false;
		try {
			return getNodeType(value) === NODE_TYPE.documentFragment;
		} catch (_) {
			return false;
		}
	};
	/**
	* Checks whether the given object is a DOM node, including nodes that
	* originate from a different window/realm (e.g. an iframe's
	* contentDocument). The previous `value instanceof Node` check was
	* realm-bound: nodes from a different window failed it, causing
	* sanitize() to silently stringify them and reset IN_PLACE to false,
	* returning the original node unsanitized. See GHSA-4w3q-35jp-p934.
	*
	* @param value object to check whether it's a DOM node
	* @return true if value is a DOM node from any realm
	*/
	const _isNode = function _isNode(value) {
		if (!getNodeType || typeof value !== "object" || value === null) return false;
		try {
			return typeof getNodeType(value) === "number";
		} catch (_) {
			return false;
		}
	};
	function _executeHooks(hooks, currentNode, data) {
		if (hooks.length === 0) return;
		arrayForEach(hooks, (hook) => {
			hook.call(DOMPurify, currentNode, data, CONFIG);
		});
	}
	/**
	* Structural-threat checks that condemn a node regardless of the
	* allowlists: mXSS via namespace confusion, risky CSS construction,
	* processing instructions, markup-bearing comments. Pure predicate;
	* the caller removes. Check order is load-bearing.
	*
	* @param currentNode the node to inspect
	* @param tagName the node's transformCaseFunc'd tag name
	* @return true if the node must be removed
	*/
	const _isUnsafeNode = function _isUnsafeNode(currentNode, tagName) {
		if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
		if (SAFE_FOR_XML && LITERAL_TEXT_ELEMENTS[tagName] && _readNodeType(currentNode) === NODE_TYPE.element && _readNamespaceURI(currentNode) === HTML_NAMESPACE && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent))) return true;
		if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
		if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
		return false;
	};
	/**
	* Evaluate a CUSTOM_ELEMENT_HANDLING check (a RegExp or a predicate
	* function, per the validation in _parseConfig) against a name.
	* Additional arguments are forwarded to predicate functions - the
	* attributeNameCheck predicate receives the tag name as its second
	* argument. A null/absent check never matches.
	*
	* @param check the configured tagNameCheck / attributeNameCheck value
	* @param name the name to test
	* @param args extra arguments forwarded to a predicate function
	* @return true if the check matches the name
	*/
	const _matchesNameCheck = function _matchesNameCheck(check, name) {
		if (check instanceof RegExp) return regExpTest(check, name);
		if (check instanceof Function) {
			for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
			return Boolean(check(name, ...args));
		}
		return false;
	};
	/**
	* Handle a node whose tag is forbidden or not allowlisted: keep
	* allowed custom elements (false return exits _sanitizeElements
	* early - the namespace and fallback-tag removal checks are
	* intentionally skipped for kept custom elements), else hoist
	* content per KEEP_CONTENT and remove.
	*
	* A kept custom element is the ONLY case in which this function
	* returns false, so the caller uses that return value to run the
	* afterSanitizeElements hook on the kept element and keep the
	* element-hook lifecycle consistent with normal allowlisted
	* elements (GHSA-c2j3-45gr-mqc4).
	*
	* @param currentNode the disallowed node
	* @param tagName the node's transformCaseFunc'd tag name
	* @return true if the node was removed, false if kept
	*/
	const _sanitizeDisallowedNode = function _sanitizeDisallowedNode(currentNode, tagName, root) {
		if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
		if (KEEP_CONTENT && !FORBID_CONTENTS[tagName] && !FORBID_CONTENTS[stringToLowerCase(tagName)]) {
			const parentNode = getParentNode(currentNode);
			const childNodes = getChildNodes(currentNode);
			if (childNodes && parentNode) {
				const childCount = childNodes.length;
				for (let i = childCount - 1; i >= 0; --i) {
					const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
					parentNode.insertBefore(hoisted, getNextSibling(currentNode));
				}
			}
		}
		_forceRemove(currentNode);
		return true;
	};
	/**
	* Fork a hook-mutable allowlist off its shared binding the first time a
	* (possibly lazily-installed) uponSanitize* hook is about to see it, so the
	* hook cannot widen the per-instance default or the setConfig binding by
	* reference and leak past the call. Returns the set unchanged once it is
	* already call-local, so repeated calls across elements are idempotent.
	*
	* @param hookList the uponSanitize* hook array for this event
	* @param set the current ALLOWED_TAGS / ALLOWED_ATTR binding
	* @param defaultSet the per-instance DEFAULT_ALLOWED_* constant
	* @param setConfigSet the captured setConfig() binding, or null
	* @return a call-local clone if a hook is present and set is still shared,
	*   else set unchanged
	*/
	const _forkSharedAllowlist = function _forkSharedAllowlist(hookList, set, defaultSet, setConfigSet) {
		if (hookList.length === 0) return set;
		return set === defaultSet || set === setConfigSet ? clone(set) : set;
	};
	/**
	* A hook may have detached the node it was called for. If so, treat it as
	* removed and stop processing it; the walk root is exempt. On the IN_PLACE
	* path the detached subtree is neutralized right away.
	*
	* @param currentNode the node a hook may have detached
	* @param root the current walk root
	* @return true if the node was detached
	*/
	const _handleHookDetachedNode = function _handleHookDetachedNode(currentNode, root) {
		if (currentNode === root || getParentNode(currentNode) !== null) return false;
		if (IN_PLACE) _neutralizeSubtree(currentNode);
		return true;
	};
	/**
	* _sanitizeElements
	*
	* @protect nodeName
	* @protect textContent
	* @protect removeChild
	* @param currentNode to check for permission to exist
	* @return true if node was killed, false if left alive
	*/
	const _sanitizeElements = function _sanitizeElements(currentNode, root) {
		_markVisited(currentNode);
		_executeHooks(hooks.beforeSanitizeElements, currentNode, null);
		if (_handleHookDetachedNode(currentNode, root)) return true;
		if (_isClobbered(currentNode)) {
			_forceRemove(currentNode);
			return true;
		}
		const tagName = transformCaseFunc(_readNodeName(currentNode));
		ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
		_executeHooks(hooks.uponSanitizeElement, currentNode, {
			tagName,
			allowedTags: ALLOWED_TAGS
		});
		if (_handleHookDetachedNode(currentNode, root)) return true;
		if (_isUnsafeNode(currentNode, tagName)) {
			_forceRemove(currentNode);
			return true;
		}
		if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
			const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
			if (removed === false) {
				_executeHooks(hooks.afterSanitizeElements, currentNode, null);
				if (_handleHookDetachedNode(currentNode, root)) return true;
			}
			return removed;
		}
		if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
			_forceRemove(currentNode);
			return true;
		}
		if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
			_forceRemove(currentNode);
			return true;
		}
		if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
			const content = _stripTemplateExpressions(currentNode.textContent);
			if (currentNode.textContent !== content) {
				arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
				currentNode.textContent = content;
			}
		}
		_executeHooks(hooks.afterSanitizeElements, currentNode, null);
		return _handleHookDetachedNode(currentNode, root);
	};
	/**
	* _isValidAttribute
	*
	* @param lcTag Lowercase tag name of containing element.
	* @param lcName Lowercase attribute name.
	* @param value Attribute value.
	* @return Returns true if `value` is valid, otherwise false.
	*/
	const _isValidAttribute = function _isValidAttribute(lcTag, lcName, value) {
		if (FORBID_ATTR[lcName]) return false;
		if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
		if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document || value in formElement)) return false;
		const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
		if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
		if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
		if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
		if (URI_SAFE_ATTRIBUTES[lcName]) return true;
		if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
		if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
		if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
		return !value;
	};
	const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
		"annotation-xml",
		"color-profile",
		"font-face",
		"font-face-format",
		"font-face-name",
		"font-face-src",
		"font-face-uri",
		"missing-glyph"
	]);
	/**
	* _isBasicCustomElement
	* checks if at least one dash is included in tagName, and it's not the first char
	* for more sophisticated checking see https://github.com/sindresorhus/validate-element-name
	*
	* @param tagName name of the tag of the node to sanitize
	* @returns Returns true if the tag name meets the basic criteria for a custom element, otherwise false.
	*/
	const _isBasicCustomElement = function _isBasicCustomElement(tagName) {
		return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
	};
	/**
	* Wrap an attribute value in the matching Trusted Types object when
	* the active policy requires it. Namespaced attributes pass through
	* unchanged (no TT support yet, see
	* https://bugs.chromium.org/p/chromium/issues/detail?id=1305293).
	*
	* @param lcTag lowercase tag name of the containing element
	* @param lcName lowercase attribute name
	* @param namespaceURI the attribute's namespace, if any
	* @param value the attribute value to wrap
	* @return the value, wrapped when Trusted Types demand it
	*/
	const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value) {
		if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
			case "TrustedHTML": return _createTrustedHTML(value);
			case "TrustedScriptURL": return _createTrustedScriptURL(value);
		}
		return value;
	};
	/**
	* Write a modified attribute value back onto the element. On
	* success, re-probe for clobbering introduced by the new value and
	* remove the element when found; otherwise, when this writeback is the
	* recreate half of the SANITIZE_NAMED_PROPS remove-and-recreate, pop the
	* removal entry that path recorded so it does not show as removed. On
	* failure, remove the attribute instead.
	*
	* Returns true only on a clean write (the value was set and the new value
	* introduced no clobbering). The caller uses that, together with its own
	* knowledge of whether this attribute pushed a DOMPurify.removed record, to
	* decide whether to pop that record. The pop must happen ONLY for the
	* named-prop remove-and-recreate; popping on any other value change (trim,
	* template scrubbing, Trusted Types) would consume an unrelated _forceRemove
	* subtree-cleanup record and let that detached subtree keep a live event
	* handler through the IN_PLACE neutralization pass (SO-001).
	*
	* @param currentNode the element carrying the attribute
	* @param name the attribute name as present on the element
	* @param namespaceURI the attribute's namespace, if any
	* @param value the new attribute value
	* @return true if the value was written without introducing clobbering
	*/
	const _setAttributeValue = function _setAttributeValue(currentNode, name, namespaceURI, value) {
		try {
			if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
			else currentNode.setAttribute(name, value);
			if (_isClobbered(currentNode)) {
				_forceRemove(currentNode);
				return false;
			}
			return true;
		} catch (_) {
			_removeAttribute(name, currentNode);
			return false;
		}
	};
	/**
	* _isUnsafeAttributeValue
	*
	* Value-based attribute checks that the attribute walk applies before any
	* hook can force-keep an attribute, shared with the public
	* isValidAttribute() so that it never approves a value sanitize() would
	* strip.
	*
	* @param name the attribute name as found on the node (case preserved)
	* @param value the attribute value
	* @returns true if the attribute must be removed because of its value
	*/
	const _isUnsafeAttributeValue = function _isUnsafeAttributeValue(name, value) {
		if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) return true;
		return stringToLowerCase(name) === "attributename" && stringMatch(value, "href") !== null;
	};
	/**
	* _sanitizeAttributes
	*
	* @protect attributes
	* @protect nodeName
	* @protect removeAttribute
	* @protect setAttribute
	*
	* @param currentNode to sanitize
	* @param root the current walk root
	*/
	const _sanitizeAttributes = function _sanitizeAttributes(currentNode, root) {
		_executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
		if (_handleHookDetachedNode(currentNode, root)) return;
		const attributes = currentNode.attributes;
		if (!attributes || _isClobbered(currentNode)) return;
		ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
		const hookEvent = {
			attrName: "",
			attrValue: "",
			keepAttr: true,
			allowedAttributes: ALLOWED_ATTR,
			forceKeepAttr: void 0
		};
		let l = attributes.length;
		const lcTag = transformCaseFunc(currentNode.nodeName);
		while (l--) {
			const attr = attributes[l];
			const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
			const lcName = transformCaseFunc(name);
			const initValue = attrValue;
			let value = name === "value" ? initValue : stringTrim(initValue);
			let recreatedNamedProp = false;
			hookEvent.attrName = lcName;
			hookEvent.attrValue = value;
			hookEvent.keepAttr = true;
			hookEvent.forceKeepAttr = void 0;
			_executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
			value = hookEvent.attrValue;
			if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
				_removeAttribute(name, currentNode, attr);
				value = SANITIZE_NAMED_PROPS_PREFIX + value;
				recreatedNamedProp = true;
			}
			if (_isUnsafeAttributeValue(name, value)) {
				_removeAttribute(name, currentNode, attr);
				continue;
			}
			if (hookEvent.forceKeepAttr) continue;
			if (!hookEvent.keepAttr) {
				_removeAttribute(name, currentNode, attr);
				continue;
			}
			if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
				_removeAttribute(name, currentNode, attr);
				continue;
			}
			if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
			if (!_isValidAttribute(lcTag, lcName, value)) {
				_removeAttribute(name, currentNode, attr);
				continue;
			}
			value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
			if (value !== initValue) {
				if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
			}
		}
		_executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
		_handleHookDetachedNode(currentNode, root);
	};
	/**
	* _sanitizeShadowDOM
	*
	* @param fragment to iterate over recursively
	*/
	const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
		let shadowNode = null;
		const shadowIterator = _createNodeIterator(fragment);
		_executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
		while (shadowNode = shadowIterator.nextNode()) {
			_executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
			_sanitizeElements(shadowNode, fragment);
			_sanitizeAttributes(shadowNode, fragment);
			if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
			if (_readNodeType(shadowNode) === NODE_TYPE.element) {
				const innerSr = getShadowRoot(shadowNode);
				if (_isDocumentFragment(innerSr)) {
					_sanitizeAttachedShadowRoots(innerSr);
					_sanitizeShadowDOM2(innerSr);
				}
			}
		}
		if (SAFE_FOR_TEMPLATES) _scrubOwnCharacterData(fragment);
		_executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
	};
	/**
	* Sanitizes every attached shadow root under `root`, since the node
	* iterator does not enter shadow trees. Needed for IN_PLACE input and for
	* DOM input whose clonable shadow roots were copied by importNode().
	*
	* @param root the subtree root to walk for attached shadow roots
	*/
	const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots(root) {
		const stack = [{
			node: root,
			shadow: null
		}];
		while (stack.length > 0) {
			const item = stack.pop();
			if (item.shadow) {
				_sanitizeShadowDOM2(item.shadow);
				continue;
			}
			const node = item.node;
			const isElement = _readNodeType(node) === NODE_TYPE.element;
			const childNodes = getChildNodes(node);
			if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
				node: childNodes[i],
				shadow: null
			});
			if (isElement) {
				const rootName = getNodeName ? getNodeName(node) : null;
				if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
					const content = node.content;
					if (_isDocumentFragment(content)) stack.push({
						node: content,
						shadow: null
					});
				}
			}
			if (isElement) {
				const sr = getShadowRoot(node);
				if (_isDocumentFragment(sr)) stack.push({
					node: null,
					shadow: sr
				}, {
					node: sr,
					shadow: null
				});
			}
		}
	};
	DOMPurify.sanitize = function(dirty) {
		let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
		let body = null;
		let importedNode = null;
		let currentNode = null;
		let returnNode = null;
		IS_EMPTY_INPUT = !dirty;
		if (IS_EMPTY_INPUT) dirty = "<!-->";
		if (typeof dirty !== "string" && !_isNode(dirty)) {
			dirty = stringifyValue(dirty);
			if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
		}
		if (!DOMPurify.isSupported) return dirty;
		if (SET_CONFIG) {
			ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
			ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
		} else _parseConfig(cfg);
		if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
		if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
		DOMPurify.removed = [];
		const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
		let inPlaceNodes = [];
		const outerVisited = IN_PLACE_VISITED;
		if (inPlace) {
			_neutralizePatchLinkage(dirty);
			const nn = _readNodeName(dirty);
			if (typeof nn === "string") {
				const tagName = transformCaseFunc(nn);
				if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
					_neutralizeRoot(dirty);
					throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
				}
			}
			if (_isClobbered(dirty)) {
				_neutralizeRoot(dirty);
				throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
			}
			inPlaceNodes = _collectLiveNodes(dirty);
			IN_PLACE_VISITED = setCreate();
		} else if (_isNode(dirty)) {
			body = _initDocument("<!---->");
			importedNode = body.ownerDocument.importNode(dirty, true);
			if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
			else if (importedNode.nodeName === "HTML") body = importedNode;
			else body.appendChild(importedNode);
			_sanitizeAttachedShadowRoots(body);
		} else {
			if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
			body = _initDocument(dirty);
			if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
		}
		if (body && FORCE_BODY) _forceRemove(body.firstChild);
		const walkRoot = inPlace ? dirty : body;
		try {
			if (inPlace) _sanitizeAttachedShadowRoots(dirty);
			const nodeIterator = _createNodeIterator(walkRoot);
			while (currentNode = nodeIterator.nextNode()) {
				_sanitizeElements(currentNode, walkRoot);
				_sanitizeAttributes(currentNode, walkRoot);
				if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
			}
			if (inPlace) _sanitizeUnvisitedNodes(dirty, inPlaceNodes);
		} catch (error) {
			if (inPlace) {
				_neutralizeRoot(dirty);
				_neutralizeDiscarded(dirty, inPlaceNodes);
			}
			throw error;
		} finally {
			IN_PLACE_VISITED = outerVisited;
		}
		if (inPlace) {
			if (_neutralizeDiscarded(dirty, inPlaceNodes)) throw typeErrorCreate("a node selected for removal could not be safely returned; refusing to sanitize in place");
			if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
			return dirty;
		}
		if (RETURN_DOM) {
			if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
			if (RETURN_DOM_FRAGMENT) {
				returnNode = createDocumentFragment.call(body.ownerDocument);
				while (body.firstChild) returnNode.appendChild(body.firstChild);
			} else returnNode = body;
			if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
			return returnNode;
		}
		let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
		if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
		if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
		return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
	};
	DOMPurify.setConfig = function() {
		let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
		_parseConfig(cfg);
		SET_CONFIG = true;
		SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
		SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
	};
	DOMPurify.clearConfig = function() {
		CONFIG = null;
		SET_CONFIG = false;
		SET_CONFIG_ALLOWED_TAGS = null;
		SET_CONFIG_ALLOWED_ATTR = null;
		trustedTypesPolicy = defaultTrustedTypesPolicy;
		emptyHTML = "";
	};
	DOMPurify.isValidAttribute = function(tag, attr, value) {
		if (!CONFIG) _parseConfig({});
		const lcTag = transformCaseFunc(tag);
		const lcName = transformCaseFunc(attr);
		if (typeof value === "string" && (_isUnsafeAttributeValue(attr, value) || !ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value))) return false;
		return _isValidAttribute(lcTag, lcName, value);
	};
	DOMPurify.addHook = function(entryPoint, hookFunction) {
		if (typeof hookFunction !== "function") return;
		if (!objectHasOwnProperty(hooks, entryPoint)) return;
		arrayPush(hooks[entryPoint], hookFunction);
	};
	DOMPurify.removeHook = function(entryPoint, hookFunction) {
		if (!objectHasOwnProperty(hooks, entryPoint)) return;
		if (hookFunction !== void 0) {
			const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
			return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
		}
		return arrayPop(hooks[entryPoint]);
	};
	DOMPurify.removeHooks = function(entryPoint) {
		if (!objectHasOwnProperty(hooks, entryPoint)) return;
		hooks[entryPoint] = [];
	};
	DOMPurify.removeAllHooks = function() {
		hooks = _createHooksMap();
	};
	return DOMPurify;
}
var purify_default = createDOMPurify();


//# sourceMappingURL=purify.es.mjs.map

/***/ },

/***/ "./node_modules/sequential-workflow-designer-react/lib/esm/index.js"
/*!**************************************************************************!*\
  !*** ./node_modules/sequential-workflow-designer-react/lib/esm/index.js ***!
  \**************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Presenter: () => (/* binding */ Presenter),
/* harmony export */   RootEditorWrapperContext: () => (/* binding */ RootEditorWrapperContext),
/* harmony export */   SequentialWorkflowDesigner: () => (/* binding */ SequentialWorkflowDesigner),
/* harmony export */   SequentialWorkflowDesignerController: () => (/* binding */ SequentialWorkflowDesignerController),
/* harmony export */   StepEditorWrapperContext: () => (/* binding */ StepEditorWrapperContext),
/* harmony export */   useRootEditor: () => (/* binding */ useRootEditor),
/* harmony export */   useSequentialWorkflowDesignerController: () => (/* binding */ useSequentialWorkflowDesignerController),
/* harmony export */   useStepEditor: () => (/* binding */ useStepEditor),
/* harmony export */   wrapDefinition: () => (/* binding */ wrapDefinition)
/* harmony export */ });
/* harmony import */ var react_dom_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-dom/client */ "react-dom/client");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react/jsx-runtime */ "./src/component/react-jsx-runtime-shim.ts");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! sequential-workflow-designer */ "./node_modules/sequential-workflow-designer/lib/esm/index.js");





var Presenter = /** @class */ (function () {
    function Presenter() {
    }
    Presenter.render = function (className, rootRef, element) {
        Presenter.tryDestroy(rootRef);
        var container = document.createElement('div');
        container.className = className;
        rootRef.current = react_dom_client__WEBPACK_IMPORTED_MODULE_0__.createRoot(container);
        rootRef.current.render(element);
        return container;
    };
    Presenter.tryDestroy = function (rootRef) {
        if (rootRef.current) {
            var oldRoot_1 = rootRef.current;
            rootRef.current = null;
            setTimeout(function () { return oldRoot_1.unmount(); });
        }
    };
    return Presenter;
}());

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

if (!window.sqdRootEditorContext) {
    window.sqdRootEditorContext = (0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)(null);
}
var rootEditorContext = window.sqdRootEditorContext;
function useRootEditor() {
    var wrapper = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(rootEditorContext);
    if (!wrapper) {
        throw new Error('Cannot find root editor context');
    }
    return wrapper;
}
function RootEditorWrapperContext(props) {
    var _a = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(function () { return createWrapper(); }), wrapper = _a[0], setWrapper = _a[1];
    function createWrapper() {
        return {
            properties: props.definition.properties,
            definition: props.definition,
            isReadonly: props.isReadonly,
            setProperty: setProperty
        };
    }
    function forward() {
        setWrapper(createWrapper());
    }
    function setProperty(name, value) {
        props.definition.properties[name] = value;
        props.context.notifyPropertiesChanged();
        forward();
    }
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(rootEditorContext.Provider, __assign({ value: wrapper }, { children: props.children }));
}

if (!window.sqdStepEditorContext) {
    window.sqdStepEditorContext = (0,react__WEBPACK_IMPORTED_MODULE_2__.createContext)(null);
}
var stepEditorContext = window.sqdStepEditorContext;
function useStepEditor() {
    var wrapper = (0,react__WEBPACK_IMPORTED_MODULE_2__.useContext)(stepEditorContext);
    if (!wrapper) {
        throw new Error('Cannot find step editor context');
    }
    return wrapper;
}
function StepEditorWrapperContext(props) {
    var _a = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(function () { return createWrapper(); }), wrapper = _a[0], setWrapper = _a[1];
    function createWrapper() {
        return {
            id: props.step.id,
            type: props.step.type,
            componentType: props.step.componentType,
            name: props.step.name,
            properties: props.step.properties,
            step: props.step,
            definition: props.definition,
            isReadonly: props.isReadonly,
            setName: setName,
            setProperty: setProperty,
            notifyPropertiesChanged: notifyPropertiesChanged,
            notifyChildrenChanged: notifyChildrenChanged
        };
    }
    function forward() {
        setWrapper(createWrapper());
    }
    function setName(name) {
        props.step.name = name;
        notifyNameChanged();
    }
    function setProperty(name, value) {
        props.step.properties[name] = value;
        notifyPropertiesChanged();
    }
    function notifyNameChanged() {
        props.context.notifyNameChanged();
        forward();
    }
    function notifyPropertiesChanged() {
        props.context.notifyPropertiesChanged();
        forward();
    }
    function notifyChildrenChanged() {
        props.context.notifyChildrenChanged();
        forward();
    }
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(stepEditorContext.Provider, __assign({ value: wrapper }, { children: props.children }));
}

function wrapDefinition(value, isValid) {
    return {
        value: value,
        isValid: isValid
    };
}

var externalEditorClassName = 'sqd-editor-react';
function SequentialWorkflowDesigner(props) {
    var _a = (0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(null), root = _a[0], setRoot = _a[1];
    var onDefinitionChangeRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.onDefinitionChange);
    var onSelectedStepIdChangedRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.onSelectedStepIdChanged);
    var onStepUnselectionBlockedRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.onStepUnselectionBlocked);
    var onIsEditorCollapsedChangedRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.onIsEditorCollapsedChanged);
    var onIsToolboxCollapsedChangedRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.onIsToolboxCollapsedChanged);
    var rootEditorRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.rootEditor);
    var stepEditorRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.stepEditor);
    var controllerRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.controller);
    var customActionHandlerRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(props.customActionHandler);
    var designerRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
    var editorRootRef = (0,react__WEBPACK_IMPORTED_MODULE_2__.useRef)(null);
    var definition = props.definition;
    var selectedStepId = props.selectedStepId;
    var isReadonly = props.isReadonly;
    var theme = props.theme;
    var undoStackSize = props.undoStackSize;
    var steps = props.stepsConfiguration;
    var validator = props.validatorConfiguration;
    var placeholder = props.placeholderConfiguration;
    var toolbox = props.toolboxConfiguration;
    var isEditorCollapsed = props.isEditorCollapsed;
    var isToolboxCollapsed = props.isToolboxCollapsed;
    var controlBar = props.controlBar;
    var contextMenu = props.contextMenu;
    var keyboard = props.keyboard;
    var preferenceStorage = props.preferenceStorage;
    var extensions = props.extensions;
    var i18n = props.i18n;
    function forwardDefinition() {
        if (designerRef.current) {
            var wd = wrapDefinition(designerRef.current.getDefinition(), designerRef.current.isValid());
            onDefinitionChangeRef.current(wd);
        }
    }
    function rootEditorProvider(def, context, isReadonly) {
        if (!rootEditorRef.current) {
            throw new Error('Root editor is not provided');
        }
        if ((0,react__WEBPACK_IMPORTED_MODULE_2__.isValidElement)(rootEditorRef.current)) {
            return Presenter.render(externalEditorClassName, editorRootRef, (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(RootEditorWrapperContext, __assign({ definition: def, context: context, isReadonly: isReadonly }, { children: rootEditorRef.current })));
        }
        return rootEditorRef.current(def, context, isReadonly);
    }
    function stepEditorProvider(step, context, def, isReadonly) {
        if (!stepEditorRef.current) {
            throw new Error('Step editor is not provided');
        }
        if ((0,react__WEBPACK_IMPORTED_MODULE_2__.isValidElement)(stepEditorRef.current)) {
            return Presenter.render(externalEditorClassName, editorRootRef, (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)(StepEditorWrapperContext, __assign({ step: step, definition: def, context: context, isReadonly: isReadonly }, { children: stepEditorRef.current })));
        }
        return stepEditorRef.current(step, context, def, isReadonly);
    }
    function customActionHandler(action, step, sequence, context) {
        if (customActionHandlerRef.current) {
            customActionHandlerRef.current(action, step, sequence, context);
        }
    }
    function tryDestroy() {
        Presenter.tryDestroy(editorRootRef);
        if (controllerRef.current) {
            controllerRef.current.setDesigner(null);
        }
        if (designerRef.current) {
            designerRef.current.destroy();
            designerRef.current = null;
            // console.log('sqd: designer destroyed');
        }
    }
    ;(0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        onDefinitionChangeRef.current = props.onDefinitionChange;
    }, [props.onDefinitionChange]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        onSelectedStepIdChangedRef.current = props.onSelectedStepIdChanged;
    }, [props.onSelectedStepIdChanged]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        onStepUnselectionBlockedRef.current = props.onStepUnselectionBlocked;
    }, [props.onStepUnselectionBlocked]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        onIsEditorCollapsedChangedRef.current = props.onIsEditorCollapsedChanged;
    }, [props.onIsEditorCollapsedChanged]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        onIsToolboxCollapsedChangedRef.current = props.onIsToolboxCollapsedChanged;
    }, [props.onIsToolboxCollapsedChanged]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        rootEditorRef.current = props.rootEditor;
    }, [props.rootEditor]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        stepEditorRef.current = props.stepEditor;
    }, [props.stepEditor]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        customActionHandlerRef.current = props.customActionHandler;
    }, [props.customActionHandler]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        if (!root) {
            return;
        }
        if (designerRef.current) {
            var isNotChanged = definition.value === designerRef.current.getDefinition();
            if (isNotChanged) {
                if (selectedStepId !== undefined && selectedStepId !== designerRef.current.getSelectedStepId()) {
                    if (selectedStepId) {
                        designerRef.current.selectStepById(selectedStepId);
                    }
                    else {
                        designerRef.current.clearSelectedStep();
                    }
                    // console.log('sqd: selected step updated');
                }
                if (isReadonly !== undefined && isReadonly !== designerRef.current.isReadonly()) {
                    designerRef.current.setIsReadonly(isReadonly);
                    // console.log('sqd: isReadonly updated');
                }
                if (isToolboxCollapsed !== undefined && isToolboxCollapsed !== designerRef.current.isToolboxCollapsed()) {
                    designerRef.current.setIsToolboxCollapsed(isToolboxCollapsed);
                    // console.log('sqd: isToolboxCollapsed updated');
                }
                if (isEditorCollapsed !== undefined && isEditorCollapsed !== designerRef.current.isEditorCollapsed()) {
                    designerRef.current.setIsEditorCollapsed(isEditorCollapsed);
                    // console.log('sqd: isEditorCollapsed updated');
                }
                return;
            }
            tryDestroy();
        }
        var designer = sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_3__.Designer.create(root, definition.value, {
            theme: theme,
            undoStackSize: undoStackSize,
            toolbox: toolbox
                ? __assign(__assign({}, toolbox), { isCollapsed: isToolboxCollapsed }) : false,
            steps: steps,
            validator: validator,
            placeholder: placeholder,
            controlBar: controlBar,
            contextMenu: contextMenu,
            keyboard: keyboard,
            preferenceStorage: preferenceStorage,
            editors: rootEditorRef.current && stepEditorRef.current
                ? {
                    isCollapsed: isEditorCollapsed,
                    rootEditorProvider: rootEditorProvider,
                    stepEditorProvider: stepEditorProvider
                }
                : false,
            customActionHandler: customActionHandlerRef.current && customActionHandler,
            extensions: extensions,
            i18n: i18n,
            isReadonly: isReadonly
        });
        if (controllerRef.current) {
            controllerRef.current.setDesigner(designer);
        }
        if (selectedStepId) {
            designer.selectStepById(selectedStepId);
        }
        // console.log('sqd: designer rendered');
        designer.onReady.subscribe(forwardDefinition);
        designer.onDefinitionChanged.subscribe(forwardDefinition);
        designer.onSelectedStepIdChanged.subscribe(function (stepId) {
            if (onSelectedStepIdChangedRef.current) {
                onSelectedStepIdChangedRef.current(stepId);
            }
        });
        designer.onStepUnselectionBlocked.subscribe(function (targetStepId) {
            if (onStepUnselectionBlockedRef.current) {
                onStepUnselectionBlockedRef.current(targetStepId);
            }
        });
        designer.onIsToolboxCollapsedChanged.subscribe(function (isCollapsed) {
            if (onIsToolboxCollapsedChangedRef.current) {
                onIsToolboxCollapsedChangedRef.current(isCollapsed);
            }
        });
        designer.onIsEditorCollapsedChanged.subscribe(function (isCollapsed) {
            if (onIsEditorCollapsedChangedRef.current) {
                onIsEditorCollapsedChangedRef.current(isCollapsed);
            }
        });
        designerRef.current = designer;
    }, [
        root,
        definition,
        selectedStepId,
        isReadonly,
        theme,
        undoStackSize,
        toolbox,
        isToolboxCollapsed,
        isEditorCollapsed,
        contextMenu,
        keyboard,
        preferenceStorage,
        controlBar,
        steps,
        validator,
        placeholder,
        extensions,
        i18n
    ]);
    (0,react__WEBPACK_IMPORTED_MODULE_2__.useEffect)(function () {
        return tryDestroy;
    }, []);
    return (0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_1__.jsx)("div", { ref: setRoot, "data-testid": "designer", className: "sqd-designer-react" });
}

var SequentialWorkflowDesignerController = /** @class */ (function () {
    function SequentialWorkflowDesignerController() {
        var _this = this;
        /**
         * @description Event that is raised when the controller is ready to be used.
         */
        this.onIsReadyChanged = new sequential_workflow_designer__WEBPACK_IMPORTED_MODULE_3__.SimpleEvent();
        this.designer = null;
        /**
         * @description Moves the viewport to the step with the animation.
         */
        this.moveViewportToStep = function (stepId) {
            _this.getDesigner().moveViewportToStep(stepId);
        };
        /**
         * @description Updates all badges.
         */
        this.updateBadges = function () {
            _this.getDesigner().updateBadges();
        };
        /**
         * @description Rerender the root component and all its children.
         */
        this.updateRootComponent = function () {
            _this.getDesigner().updateRootComponent();
        };
        /**
         * @description Updates the layout of the designer.
         */
        this.updateLayout = function () {
            _this.getDesigner().updateLayout();
        };
        /**
         * Replaces the current definition with a new one and adds the previous definition to the undo stack.
         * @param definition A new definition.
         */
        this.replaceDefinition = function (definition) {
            return _this.getDesigner().replaceDefinition(definition);
        };
        // Nothing...
    }
    SequentialWorkflowDesignerController.create = function () {
        return new SequentialWorkflowDesignerController();
    };
    /**
     * @returns `true` if the controller is ready to be used, `false` otherwise.
     */
    SequentialWorkflowDesignerController.prototype.isReady = function () {
        return Boolean(this.designer);
    };
    SequentialWorkflowDesignerController.prototype.setDesigner = function (designer) {
        if (designer && this.designer) {
            throw new Error('Designer is already set');
        }
        this.designer = designer;
        this.onIsReadyChanged.forward();
    };
    SequentialWorkflowDesignerController.prototype.getDesigner = function () {
        if (!this.designer) {
            throw new Error('Designer is not ready yet');
        }
        return this.designer;
    };
    return SequentialWorkflowDesignerController;
}());
function useSequentialWorkflowDesignerController(deps) {
    return (0,react__WEBPACK_IMPORTED_MODULE_2__.useMemo)(function () { return SequentialWorkflowDesignerController.create(); }, deps || []);
}




/***/ },

/***/ "./node_modules/sequential-workflow-designer/lib/esm/index.js"
/*!********************************************************************!*\
  !*** ./node_modules/sequential-workflow-designer/lib/esm/index.js ***!
  \********************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Badges: () => (/* binding */ Badges),
/* harmony export */   CenteredViewportCalculator: () => (/* binding */ CenteredViewportCalculator),
/* harmony export */   ClassicWheelControllerExtension: () => (/* binding */ ClassicWheelControllerExtension),
/* harmony export */   ClickCommandType: () => (/* binding */ ClickCommandType),
/* harmony export */   ComponentContext: () => (/* binding */ ComponentContext),
/* harmony export */   ComponentDom: () => (/* binding */ ComponentDom),
/* harmony export */   ControlBarApi: () => (/* binding */ ControlBarApi),
/* harmony export */   CustomActionController: () => (/* binding */ CustomActionController),
/* harmony export */   DefaultRegionComponentViewExtension: () => (/* binding */ DefaultRegionComponentViewExtension),
/* harmony export */   DefaultRegionView: () => (/* binding */ DefaultRegionView),
/* harmony export */   DefaultSequenceComponent: () => (/* binding */ DefaultSequenceComponent),
/* harmony export */   DefaultSequenceComponentView: () => (/* binding */ DefaultSequenceComponentView),
/* harmony export */   DefaultViewportController: () => (/* binding */ DefaultViewportController),
/* harmony export */   DefaultViewportControllerDesignerExtension: () => (/* binding */ DefaultViewportControllerDesignerExtension),
/* harmony export */   DefaultViewportControllerExtension: () => (/* binding */ DefaultViewportControllerExtension),
/* harmony export */   DefinitionChangeType: () => (/* binding */ DefinitionChangeType),
/* harmony export */   DefinitionWalker: () => (/* reexport safe */ sequential_workflow_model__WEBPACK_IMPORTED_MODULE_0__.DefinitionWalker),
/* harmony export */   Designer: () => (/* binding */ Designer),
/* harmony export */   DesignerApi: () => (/* binding */ DesignerApi),
/* harmony export */   DesignerContext: () => (/* binding */ DesignerContext),
/* harmony export */   DesignerState: () => (/* binding */ DesignerState),
/* harmony export */   Dom: () => (/* binding */ Dom),
/* harmony export */   Editor: () => (/* binding */ Editor),
/* harmony export */   EditorApi: () => (/* binding */ EditorApi),
/* harmony export */   Icons: () => (/* binding */ Icons),
/* harmony export */   InputView: () => (/* binding */ InputView),
/* harmony export */   JoinView: () => (/* binding */ JoinView),
/* harmony export */   KeyboardAction: () => (/* binding */ KeyboardAction),
/* harmony export */   LabelView: () => (/* binding */ LabelView),
/* harmony export */   LineGridDesignerExtension: () => (/* binding */ LineGridDesignerExtension),
/* harmony export */   ObjectCloner: () => (/* binding */ ObjectCloner),
/* harmony export */   OutputView: () => (/* binding */ OutputView),
/* harmony export */   PathBarApi: () => (/* binding */ PathBarApi),
/* harmony export */   PlaceholderController: () => (/* binding */ PlaceholderController),
/* harmony export */   PlaceholderDirection: () => (/* binding */ PlaceholderDirection),
/* harmony export */   PlaceholderGapOrientation: () => (/* binding */ PlaceholderGapOrientation),
/* harmony export */   RectPlaceholder: () => (/* binding */ RectPlaceholder),
/* harmony export */   RectPlaceholderDesignerExtension: () => (/* binding */ RectPlaceholderDesignerExtension),
/* harmony export */   RectPlaceholderView: () => (/* binding */ RectPlaceholderView),
/* harmony export */   SelectStepBehaviorEndToken: () => (/* binding */ SelectStepBehaviorEndToken),
/* harmony export */   ServicesResolver: () => (/* binding */ ServicesResolver),
/* harmony export */   SimpleEvent: () => (/* binding */ SimpleEvent),
/* harmony export */   StartStopRootComponentDesignerExtension: () => (/* binding */ StartStopRootComponentDesignerExtension),
/* harmony export */   StartStopRootComponentExtension: () => (/* binding */ StartStopRootComponentExtension),
/* harmony export */   StepChildrenType: () => (/* reexport safe */ sequential_workflow_model__WEBPACK_IMPORTED_MODULE_0__.StepChildrenType),
/* harmony export */   StepComponent: () => (/* binding */ StepComponent),
/* harmony export */   StepExtensionResolver: () => (/* binding */ StepExtensionResolver),
/* harmony export */   StepsDesignerExtension: () => (/* binding */ StepsDesignerExtension),
/* harmony export */   TYPE: () => (/* binding */ TYPE),
/* harmony export */   ToolboxApi: () => (/* binding */ ToolboxApi),
/* harmony export */   Uid: () => (/* binding */ Uid),
/* harmony export */   ValidationErrorBadgeExtension: () => (/* binding */ ValidationErrorBadgeExtension),
/* harmony export */   Vector: () => (/* binding */ Vector),
/* harmony export */   ViewportApi: () => (/* binding */ ViewportApi),
/* harmony export */   WorkspaceApi: () => (/* binding */ WorkspaceApi),
/* harmony export */   createContainerStepComponentViewFactory: () => (/* binding */ createContainerStepComponentViewFactory),
/* harmony export */   createLaunchPadStepComponentViewFactory: () => (/* binding */ createLaunchPadStepComponentViewFactory),
/* harmony export */   createSwitchStepComponentViewFactory: () => (/* binding */ createSwitchStepComponentViewFactory),
/* harmony export */   createTaskStepComponentViewFactory: () => (/* binding */ createTaskStepComponentViewFactory),
/* harmony export */   getAbsolutePosition: () => (/* binding */ getAbsolutePosition),
/* harmony export */   race: () => (/* binding */ race)
/* harmony export */ });
/* harmony import */ var sequential_workflow_model__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! sequential-workflow-model */ "./node_modules/sequential-workflow-model/lib/esm/index.js");



class Dom {
    static svg(name, attributes) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', name);
        if (attributes) {
            Dom.attrs(element, attributes);
        }
        return element;
    }
    static translate(element, x, y) {
        element.setAttribute('transform', `translate(${x}, ${y})`);
    }
    static attrs(element, attributes) {
        Object.keys(attributes).forEach(name => {
            const value = attributes[name];
            element.setAttribute(name, typeof value === 'string' ? value : value.toString());
        });
    }
    static element(name, attributes) {
        const element = document.createElement(name);
        if (attributes) {
            Dom.attrs(element, attributes);
        }
        return element;
    }
    static toggleClass(element, isEnabled, className) {
        if (isEnabled) {
            element.classList.add(className);
        }
        else {
            element.classList.remove(className);
        }
    }
}

// Source: https://fonts.google.com/icons or https://github.com/google/material-design-icons
class Icons {
    static appendPath(parent, pathClassName, d, size) {
        const g = Dom.svg('g');
        const scale = size / 48;
        const path = Dom.svg('path', {
            d,
            class: pathClassName,
            transform: `scale(${scale})`
        });
        g.appendChild(path);
        parent.appendChild(g);
        return g;
    }
    static createSvg(className, d) {
        const icon = Dom.svg('svg', {
            class: className,
            viewBox: '0 0 48 48'
        });
        const path = Dom.svg('path', {
            d,
            class: 'sqd-icon-path'
        });
        icon.appendChild(path);
        return icon;
    }
}
Icons.folderIn = 'M42.05 42.25H11.996v-7.12h17.388L6 11.746 11.546 6.2 34.93 29.584V12.196h7.12V42.25z';
Icons.folderOut = 'M6 6.2h30.054v7.12H18.666L42.05 36.704l-5.546 5.546L13.12 18.866v17.388H6V6.2z';
Icons.center = 'M9 42q-1.2 0-2.1-.9Q6 40.2 6 39v-8.6h3V39h8.6v3Zm21.4 0v-3H39v-8.6h3V39q0 1.2-.9 2.1-.9.9-2.1.9ZM24 31.15q-3.15 0-5.15-2-2-2-2-5.15 0-3.15 2-5.15 2-2 5.15-2 3.15 0 5.15 2 2 2 2 5.15 0 3.15-2 5.15-2 2-5.15 2ZM6 17.6V9q0-1.2.9-2.1Q7.8 6 9 6h8.6v3H9v8.6Zm33 0V9h-8.6V6H39q1.2 0 2.1.9.9.9.9 2.1v8.6Z';
Icons.zoomIn = 'M39.8 41.95 26.65 28.8q-1.5 1.3-3.5 2.025-2 .725-4.25.725-5.4 0-9.15-3.75T6 18.75q0-5.3 3.75-9.05 3.75-3.75 9.1-3.75 5.3 0 9.025 3.75 3.725 3.75 3.725 9.05 0 2.15-.7 4.15-.7 2-2.1 3.75L42 39.75Zm-20.95-13.4q4.05 0 6.9-2.875Q28.6 22.8 28.6 18.75t-2.85-6.925Q22.9 8.95 18.85 8.95q-4.1 0-6.975 2.875T9 18.75q0 4.05 2.875 6.925t6.975 2.875ZM17.3 24.3v-4.1h-4.1v-3h4.1v-4.05h3v4.05h4.05v3H20.3v4.1Z';
Icons.zoomOut = 'M39.8 41.95 26.65 28.8q-1.5 1.3-3.5 2.025-2 .725-4.25.725-5.4 0-9.15-3.75T6 18.75q0-5.3 3.75-9.05 3.75-3.75 9.1-3.75 5.3 0 9.025 3.75 3.725 3.75 3.725 9.05 0 2.15-.7 4.15-.7 2-2.1 3.75L42 39.75Zm-20.95-13.4q4.05 0 6.9-2.875Q28.6 22.8 28.6 18.75t-2.85-6.925Q22.9 8.95 18.85 8.95q-4.1 0-6.975 2.875T9 18.75q0 4.05 2.875 6.925t6.975 2.875Zm-5.1-8.35v-3H23.8v3Z';
Icons.undo = 'M14 38v-3h14.45q3.5 0 6.025-2.325Q37 30.35 37 26.9t-2.525-5.775Q31.95 18.8 28.45 18.8H13.7l5.7 5.7-2.1 2.1L8 17.3 17.3 8l2.1 2.1-5.7 5.7h14.7q4.75 0 8.175 3.2Q40 22.2 40 26.9t-3.425 7.9Q33.15 38 28.4 38Z';
Icons.redo = 'M19.6 38q-4.75 0-8.175-3.2Q8 31.6 8 26.9t3.425-7.9q3.425-3.2 8.175-3.2h14.7l-5.7-5.7L30.7 8l9.3 9.3-9.3 9.3-2.1-2.1 5.7-5.7H19.55q-3.5 0-6.025 2.325Q11 23.45 11 26.9t2.525 5.775Q16.05 35 19.55 35H34v3Z';
Icons.move = 'm24 44-8.15-8.15 2.2-2.2 4.45 4.45v-9.45h3v9.45l4.45-4.45 2.2 2.2ZM11.9 31.9 4 24l7.95-7.95 2.2 2.2L9.9 22.5h9.45v3H9.9l4.2 4.2Zm24.2 0-2.2-2.2 4.2-4.2h-9.4v-3h9.4l-4.2-4.2 2.2-2.2L44 24ZM22.5 19.3V9.9l-4.2 4.2-2.2-2.2L24 4l7.9 7.9-2.2 2.2-4.2-4.2v9.4Z';
Icons.delete = 'm16.5 33.6 7.5-7.5 7.5 7.5 2.1-2.1-7.5-7.5 7.5-7.5-2.1-2.1-7.5 7.5-7.5-7.5-2.1 2.1 7.5 7.5-7.5 7.5ZM24 44q-4.1 0-7.75-1.575-3.65-1.575-6.375-4.3-2.725-2.725-4.3-6.375Q4 28.1 4 24q0-4.15 1.575-7.8 1.575-3.65 4.3-6.35 2.725-2.7 6.375-4.275Q19.9 4 24 4q4.15 0 7.8 1.575 3.65 1.575 6.35 4.275 2.7 2.7 4.275 6.35Q44 19.85 44 24q0 4.1-1.575 7.75-1.575 3.65-4.275 6.375t-6.35 4.3Q28.15 44 24 44Z';
Icons.folderUp = 'M22.5 34h3V23.75l3.7 3.7 2.1-2.1-7.3-7.3-7.3 7.3 2.1 2.1 3.7-3.7ZM7.05 40q-1.2 0-2.1-.925-.9-.925-.9-2.075V11q0-1.15.9-2.075Q5.85 8 7.05 8h14l3 3h17q1.15 0 2.075.925.925.925.925 2.075v23q0 1.15-.925 2.075Q42.2 40 41.05 40Zm0-29v26h34V14H22.8l-3-3H7.05Zm0 0v26Z';
Icons.close = 'm12.45 37.65-2.1-2.1L21.9 24 10.35 12.45l2.1-2.1L24 21.9l11.55-11.55 2.1 2.1L26.1 24l11.55 11.55-2.1 2.1L24 26.1Z';
Icons.options = 'm19.4 44-1-6.3q-.95-.35-2-.95t-1.85-1.25l-5.9 2.7L4 30l5.4-3.95q-.1-.45-.125-1.025Q9.25 24.45 9.25 24q0-.45.025-1.025T9.4 21.95L4 18l4.65-8.2 5.9 2.7q.8-.65 1.85-1.25t2-.9l1-6.35h9.2l1 6.3q.95.35 2.025.925Q32.7 11.8 33.45 12.5l5.9-2.7L44 18l-5.4 3.85q.1.5.125 1.075.025.575.025 1.075t-.025 1.05q-.025.55-.125 1.05L44 30l-4.65 8.2-5.9-2.7q-.8.65-1.825 1.275-1.025.625-2.025.925l-1 6.3ZM24 30.5q2.7 0 4.6-1.9 1.9-1.9 1.9-4.6 0-2.7-1.9-4.6-1.9-1.9-4.6-1.9-2.7 0-4.6 1.9-1.9 1.9-1.9 4.6 0 2.7 1.9 4.6 1.9 1.9 4.6 1.9Z';
Icons.expand = 'm24 30.75-12-12 2.15-2.15L24 26.5l9.85-9.85L36 18.8Z';
Icons.alert = 'M24 42q-1.45 0-2.475-1.025Q20.5 39.95 20.5 38.5q0-1.45 1.025-2.475Q22.55 35 24 35q1.45 0 2.475 1.025Q27.5 37.05 27.5 38.5q0 1.45-1.025 2.475Q25.45 42 24 42Zm-3.5-12V6h7v24Z';
Icons.play = 'M14.75 40.15V7.55l25.6 16.3Z';
Icons.stop = 'M10.75 37.25V10.7H37.3v26.55Z';
Icons.folder = 'M7.05 40q-1.2 0-2.1-.925-.9-.925-.9-2.075V11q0-1.15.9-2.075Q5.85 8 7.05 8h14l3 3h17q1.15 0 2.075.925.925.925.925 2.075v23q0 1.15-.925 2.075Q42.2 40 41.05 40Z';

class ObjectCloner {
    static deepClone(instance) {
        if (typeof window.structuredClone !== 'undefined') {
            return window.structuredClone(instance);
        }
        return JSON.parse(JSON.stringify(instance));
    }
}

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(v) {
        return new Vector(this.x + v.x, this.y + v.y);
    }
    subtract(v) {
        return new Vector(this.x - v.x, this.y - v.y);
    }
    multiplyByScalar(s) {
        return new Vector(this.x * s, this.y * s);
    }
    divideByScalar(s) {
        return new Vector(this.x / s, this.y / s);
    }
    round() {
        return new Vector(Math.round(this.x), Math.round(this.y));
    }
    distance() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
}

function getAbsolutePosition(element) {
    const rect = element.getBoundingClientRect();
    return new Vector(rect.x + window.scrollX, rect.y + window.scrollY);
}

class Uid {
    static next() {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');
    }
}

class SimpleEvent {
    constructor() {
        this.listeners = [];
        this.forward = (value) => {
            if (this.listeners.length > 0) {
                this.listeners.forEach(listener => listener(value));
            }
        };
    }
    subscribe(listener) {
        this.listeners.push(listener);
    }
    unsubscribe(listener) {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.listeners.splice(index, 1);
        }
        else {
            throw new Error('Unknown listener');
        }
    }
    count() {
        return this.listeners.length;
    }
    first() {
        return new Promise(resolve => {
            const handler = (value) => {
                this.unsubscribe(handler);
                resolve(value);
            };
            this.subscribe(handler);
        });
    }
}

function race(timeout, a, b, c, d) {
    const value = [undefined, undefined, undefined, undefined];
    const result = new SimpleEvent();
    let scheduled = false;
    function forward() {
        if (scheduled) {
            return;
        }
        scheduled = true;
        setTimeout(() => {
            try {
                result.forward(value);
            }
            finally {
                scheduled = false;
                value.fill(undefined);
            }
        }, timeout);
    }
    function subscribe(event, index) {
        event.subscribe(v => {
            value[index] = v;
            forward();
        });
    }
    subscribe(a, 0);
    subscribe(b, 1);
    if (c) {
        subscribe(c, 2);
    }
    if (d) {
        subscribe(d, 3);
    }
    return result;
}

class ControlBarApi {
    static create(state, historyController, stateModifier) {
        const api = new ControlBarApi(state, historyController, stateModifier);
        race(0, state.onIsReadonlyChanged, state.onSelectedStepIdChanged, state.onIsDragDisabledChanged, api.isUndoRedoSupported() ? state.onDefinitionChanged : undefined).subscribe(api.onStateChanged.forward);
        return api;
    }
    constructor(state, historyController, stateModifier) {
        this.state = state;
        this.historyController = historyController;
        this.stateModifier = stateModifier;
        this.onStateChanged = new SimpleEvent();
    }
    isDragDisabled() {
        return this.state.isDragDisabled;
    }
    setIsDragDisabled(isDragDisabled) {
        this.state.setIsDragDisabled(isDragDisabled);
    }
    toggleIsDragDisabled() {
        this.setIsDragDisabled(!this.isDragDisabled());
    }
    isUndoRedoSupported() {
        return !!this.historyController;
    }
    tryUndo() {
        if (this.canUndo() && this.historyController) {
            this.historyController.undo();
            return true;
        }
        return false;
    }
    canUndo() {
        return !!this.historyController && this.historyController.canUndo() && !this.state.isReadonly && !this.state.isDragging;
    }
    tryRedo() {
        if (this.canRedo() && this.historyController) {
            this.historyController.redo();
            return true;
        }
        return false;
    }
    canRedo() {
        return !!this.historyController && this.historyController.canRedo() && !this.state.isReadonly && !this.state.isDragging;
    }
    tryDelete() {
        if (this.canDelete() && this.state.selectedStepId) {
            return this.stateModifier.tryDeleteById(this.state.selectedStepId);
        }
        return false;
    }
    canDelete() {
        return (!!this.state.selectedStepId &&
            !this.state.isReadonly &&
            !this.state.isDragging &&
            this.stateModifier.isDeletableById(this.state.selectedStepId));
    }
}

var KeyboardAction;
(function (KeyboardAction) {
    KeyboardAction["delete"] = "delete";
})(KeyboardAction || (KeyboardAction = {}));
var DefinitionChangeType;
(function (DefinitionChangeType) {
    DefinitionChangeType[DefinitionChangeType["stepNameChanged"] = 1] = "stepNameChanged";
    DefinitionChangeType[DefinitionChangeType["stepPropertyChanged"] = 2] = "stepPropertyChanged";
    DefinitionChangeType[DefinitionChangeType["stepChildrenChanged"] = 3] = "stepChildrenChanged";
    DefinitionChangeType[DefinitionChangeType["stepDeleted"] = 4] = "stepDeleted";
    DefinitionChangeType[DefinitionChangeType["stepMoved"] = 5] = "stepMoved";
    DefinitionChangeType[DefinitionChangeType["stepInserted"] = 6] = "stepInserted";
    DefinitionChangeType[DefinitionChangeType["rootPropertyChanged"] = 7] = "rootPropertyChanged";
    DefinitionChangeType[DefinitionChangeType["rootReplaced"] = 8] = "rootReplaced";
})(DefinitionChangeType || (DefinitionChangeType = {}));

class EditorRenderer {
    static create(state, selectedStepIdProvider, definitionWalker, handler) {
        const raceEvent = race(0, state.onDefinitionChanged, selectedStepIdProvider.onSelectedStepIdChanged, state.onIsReadonlyChanged);
        const listener = new EditorRenderer(state, selectedStepIdProvider, definitionWalker, handler, raceEvent);
        raceEvent.subscribe(listener.raceEventHandler);
        listener.renderIfStepChanged(selectedStepIdProvider.selectedStepId);
        return listener;
    }
    constructor(state, selectedStepIdProvider, definitionWalker, handler, raceEvent) {
        this.state = state;
        this.selectedStepIdProvider = selectedStepIdProvider;
        this.definitionWalker = definitionWalker;
        this.handler = handler;
        this.raceEvent = raceEvent;
        this.currentStepId = undefined;
        this.raceEventHandler = ([definitionChanged, selectedStepId, isReadonlyChanged]) => {
            if (isReadonlyChanged !== undefined) {
                this.render(this.selectedStepIdProvider.selectedStepId);
            }
            else if (definitionChanged) {
                if (definitionChanged.changeType === DefinitionChangeType.rootReplaced) {
                    this.render(this.selectedStepIdProvider.selectedStepId);
                }
                else {
                    this.renderIfStepChanged(this.selectedStepIdProvider.selectedStepId);
                }
            }
            else if (selectedStepId !== undefined) {
                this.renderIfStepChanged(selectedStepId);
            }
        };
    }
    destroy() {
        this.raceEvent.unsubscribe(this.raceEventHandler);
    }
    render(stepId) {
        const step = stepId ? this.definitionWalker.getById(this.state.definition, stepId) : null;
        this.currentStepId = stepId;
        this.handler(step);
    }
    renderIfStepChanged(stepId) {
        if (this.currentStepId !== stepId) {
            this.render(stepId);
        }
    }
}

class EditorApi {
    constructor(state, definitionWalker, stateModifier) {
        this.state = state;
        this.definitionWalker = definitionWalker;
        this.stateModifier = stateModifier;
    }
    isCollapsed() {
        return this.state.isEditorCollapsed;
    }
    isReadonly() {
        return this.state.isReadonly;
    }
    toggleIsCollapsed() {
        this.state.setIsEditorCollapsed(!this.state.isEditorCollapsed);
    }
    subscribeIsCollapsed(listener) {
        this.state.onIsEditorCollapsedChanged.subscribe(listener);
    }
    getDefinition() {
        return this.state.definition;
    }
    addDefinitionModifierDependency(dependency) {
        this.stateModifier.addDependency(dependency);
    }
    runRenderer(rendererHandler, customSelectedStepIdProvider) {
        const selectedStepIdProvider = customSelectedStepIdProvider || this.state;
        return EditorRenderer.create(this.state, selectedStepIdProvider, this.definitionWalker, rendererHandler);
    }
    createStepEditorContext(stepId) {
        if (!stepId) {
            throw new Error('Step id is empty');
        }
        return {
            notifyPropertiesChanged: () => {
                this.state.notifyDefinitionChanged(DefinitionChangeType.stepPropertyChanged, stepId);
            },
            notifyNameChanged: () => {
                this.state.notifyDefinitionChanged(DefinitionChangeType.stepNameChanged, stepId);
            },
            notifyChildrenChanged: () => {
                this.state.notifyDefinitionChanged(DefinitionChangeType.stepChildrenChanged, stepId);
                this.stateModifier.updateDependencies();
            }
        };
    }
    createRootEditorContext() {
        return {
            notifyPropertiesChanged: () => {
                this.state.notifyDefinitionChanged(DefinitionChangeType.rootPropertyChanged, null);
            }
        };
    }
}

class PathBarApi {
    constructor(state, definitionWalker) {
        this.state = state;
        this.definitionWalker = definitionWalker;
        this.onStateChanged = race(0, this.state.onFolderPathChanged, this.state.onDefinitionChanged);
    }
    setFolderPath(path) {
        this.state.setFolderPath(path);
    }
    getFolderPath() {
        return this.state.folderPath;
    }
    getFolderPathStepNames() {
        return this.state.folderPath.map(stepId => {
            return this.definitionWalker.getById(this.state.definition, stepId).name;
        });
    }
}

class DragStepView {
    static create(step, isAttached, theme, componentContext) {
        var _a;
        const body = (_a = componentContext.shadowRoot) !== null && _a !== void 0 ? _a : document.body;
        const layer = Dom.element('div', {
            class: `sqd-drag sqd-theme-${theme}`
        });
        body.appendChild(layer);
        const component = componentContext.services.draggedComponent.create(layer, step, isAttached, componentContext);
        return new DragStepView(component, layer, body);
    }
    constructor(component, layer, body) {
        this.component = component;
        this.layer = layer;
        this.body = body;
    }
    setPosition(position) {
        this.layer.style.top = position.y + 'px';
        this.layer.style.left = position.x + 'px';
    }
    remove() {
        this.component.destroy();
        this.body.removeChild(this.layer);
    }
}

class PlaceholderFinder {
    static create(placeholders, state) {
        const checker = new PlaceholderFinder(placeholders, state);
        state.onViewportChanged.subscribe(checker.clearCache);
        window.addEventListener('scroll', checker.clearCache, false);
        return checker;
    }
    constructor(placeholders, state) {
        this.placeholders = placeholders;
        this.state = state;
        this.clearCache = () => {
            this.cache = undefined;
        };
    }
    find(vLt, vWidth, vHeight) {
        var _a;
        if (!this.cache) {
            const scroll = new Vector(window.scrollX, window.scrollY);
            this.cache = this.placeholders.map(placeholder => {
                const rect = placeholder.getClientRect();
                const lt = new Vector(rect.x, rect.y).add(scroll);
                const br = new Vector(rect.x + rect.width, rect.y + rect.height).add(scroll);
                return {
                    placeholder,
                    lt,
                    br,
                    diagSq: lt.x * lt.x + lt.y * lt.y
                };
            });
            this.cache.sort((a, b) => a.diagSq - b.diagSq);
        }
        const vR = vLt.x + vWidth;
        const vB = vLt.y + vHeight;
        return (_a = this.cache.find(p => {
            return Math.max(vLt.x, p.lt.x) < Math.min(vR, p.br.x) && Math.max(vLt.y, p.lt.y) < Math.min(vB, p.br.y);
        })) === null || _a === void 0 ? void 0 : _a.placeholder;
    }
    destroy() {
        this.state.onViewportChanged.unsubscribe(this.clearCache);
        window.removeEventListener('scroll', this.clearCache, false);
    }
}

class DragStepBehavior {
    static create(designerContext, step, attachedStepComponent) {
        const isAttached = Boolean(attachedStepComponent);
        const view = DragStepView.create(step, isAttached, designerContext.theme, designerContext.componentContext);
        return new DragStepBehavior(view, designerContext.workspaceController, designerContext.placeholderController, designerContext.state, step, designerContext.stateModifier, attachedStepComponent);
    }
    constructor(view, workspaceController, placeholderController, designerState, step, stateModifier, attachedStepComponent) {
        this.view = view;
        this.workspaceController = workspaceController;
        this.placeholderController = placeholderController;
        this.designerState = designerState;
        this.step = step;
        this.stateModifier = stateModifier;
        this.attachedStepComponent = attachedStepComponent;
    }
    onStart(position) {
        let offset = null;
        if (this.attachedStepComponent) {
            this.attachedStepComponent.setIsDisabled(true);
            this.attachedStepComponent.setIsDragging(true);
            const hasSameSize = this.attachedStepComponent.view.width === this.view.component.width &&
                this.attachedStepComponent.view.height === this.view.component.height;
            if (hasSameSize) {
                // Mouse cursor will be positioned on the same place as the source component.
                const pagePosition = this.attachedStepComponent.view.getClientPosition();
                offset = position.subtract(pagePosition);
            }
        }
        if (!offset) {
            // Mouse cursor will be positioned in the center of the component.
            offset = new Vector(this.view.component.width, this.view.component.height).divideByScalar(2);
        }
        this.view.setPosition(position.subtract(offset));
        this.designerState.setIsDragging(true);
        const { placeholders, components } = this.resolvePlaceholders(this.attachedStepComponent);
        this.state = {
            placeholders,
            components,
            startPosition: position,
            finder: PlaceholderFinder.create(placeholders, this.designerState),
            offset
        };
        placeholders.forEach(placeholder => placeholder.setIsVisible(true));
        components.forEach(component => component.setIsDragging(true));
    }
    onMove(delta) {
        if (this.state) {
            const newPosition = this.state.startPosition.subtract(delta).subtract(this.state.offset);
            this.view.setPosition(newPosition);
            const placeholder = this.state.finder.find(newPosition, this.view.component.width, this.view.component.height);
            if (this.currentPlaceholder !== placeholder) {
                if (this.currentPlaceholder) {
                    this.currentPlaceholder.setIsHover(false);
                }
                if (placeholder) {
                    placeholder.setIsHover(true);
                }
                this.currentPlaceholder = placeholder;
            }
        }
    }
    onEnd(interrupt) {
        if (!this.state) {
            throw new Error('Invalid state');
        }
        this.state.placeholders.forEach(placeholder => placeholder.setIsVisible(false));
        this.state.components.forEach(component => component.setIsDragging(false));
        this.state.finder.destroy();
        this.state = undefined;
        this.view.remove();
        this.designerState.setIsDragging(false);
        let modified = false;
        if (!interrupt && this.currentPlaceholder) {
            if (this.attachedStepComponent) {
                modified = this.stateModifier.tryMove(this.attachedStepComponent.parentSequence, this.attachedStepComponent.step, this.currentPlaceholder.parentSequence, this.currentPlaceholder.index);
            }
            else {
                modified = this.stateModifier.tryInsert(this.step, this.currentPlaceholder.parentSequence, this.currentPlaceholder.index);
            }
        }
        if (!modified) {
            if (this.attachedStepComponent) {
                this.attachedStepComponent.setIsDisabled(false);
                this.attachedStepComponent.setIsDragging(false);
            }
            if (this.currentPlaceholder) {
                this.currentPlaceholder.setIsHover(false);
            }
        }
        this.currentPlaceholder = undefined;
    }
    resolvePlaceholders(skipComponent) {
        const result = this.workspaceController.resolvePlaceholders(skipComponent);
        if (this.placeholderController.canShow) {
            const canShow = this.placeholderController.canShow;
            result.placeholders = result.placeholders.filter(placeholder => canShow(placeholder.parentSequence, placeholder.index, this.step.componentType, this.step.type));
        }
        return result;
    }
}

class ToolboxApi {
    constructor(state, designerContext, behaviorController, toolboxDataProvider, uidGenerator) {
        this.state = state;
        this.designerContext = designerContext;
        this.behaviorController = behaviorController;
        this.toolboxDataProvider = toolboxDataProvider;
        this.uidGenerator = uidGenerator;
    }
    isCollapsed() {
        return this.state.isToolboxCollapsed;
    }
    toggleIsCollapsed() {
        this.state.setIsToolboxCollapsed(!this.state.isToolboxCollapsed);
    }
    subscribeIsCollapsed(listener) {
        this.state.onIsToolboxCollapsedChanged.subscribe(listener);
    }
    getAllGroups() {
        return this.toolboxDataProvider.getAllGroups();
    }
    applyFilter(allGroups, filter) {
        return this.toolboxDataProvider.applyFilter(allGroups, filter);
    }
    /**
     * @param position Mouse or touch position.
     * @param step Step definition.
     * @returns If started dragging returns true, otherwise returns false.
     */
    tryDrag(position, step) {
        if (!this.state.isReadonly) {
            const newStep = this.activateStep(step);
            this.behaviorController.start(position, DragStepBehavior.create(this.designerContext, newStep));
            return true;
        }
        return false;
    }
    activateStep(step) {
        const newStep = ObjectCloner.deepClone(step);
        newStep.id = this.uidGenerator();
        return newStep;
    }
}

const regexp = /^[a-zA-Z][a-zA-Z0-9_-]+$/;
class StepTypeValidator {
    static validate(type) {
        if (!regexp.test(type)) {
            throw new Error(`Step type "${type}" contains not allowed characters`);
        }
    }
}

class ToolboxDataProvider {
    constructor(i18n, iconProvider, configuration) {
        this.i18n = i18n;
        this.iconProvider = iconProvider;
        this.configuration = configuration;
        this.createItemData = (step) => {
            StepTypeValidator.validate(step.type);
            const iconUrl = this.iconProvider.getIconUrl(step);
            const rawLabel = this.configuration && this.configuration.labelProvider ? this.configuration.labelProvider(step) : step.name;
            const label = this.i18n(`toolbox.item.${step.type}.label`, rawLabel);
            const description = this.configuration && this.configuration.descriptionProvider ? this.configuration.descriptionProvider(step) : label;
            const lowerCaseLabel = label.toLowerCase();
            return {
                iconUrl,
                label,
                description,
                lowerCaseLabel,
                step
            };
        };
    }
    getAllGroups() {
        if (!this.configuration) {
            return [];
        }
        return this.configuration.groups.map(group => {
            return {
                name: group.name,
                items: group.steps.map(this.createItemData)
            };
        });
    }
    applyFilter(allGroups, filter) {
        if (!filter) {
            return allGroups;
        }
        const lowerCaseFilter = filter.toLowerCase();
        return allGroups
            .map(group => {
            return {
                name: group.name,
                items: group.items.filter(s => {
                    return s.lowerCaseLabel.includes(lowerCaseFilter);
                })
            };
        })
            .filter(group => group.items.length > 0);
    }
}

function animate(interval, handler) {
    const iv = setInterval(tick, 15);
    const startTime = Date.now();
    const anim = {
        isAlive: true,
        stop: () => {
            anim.isAlive = false;
            clearInterval(iv);
        }
    };
    function tick() {
        const progress = Math.min((Date.now() - startTime) / interval, 1);
        handler(progress);
        if (progress === 1) {
            anim.stop();
        }
    }
    return anim;
}

class ViewportAnimator {
    constructor(state) {
        this.state = state;
    }
    execute(target) {
        if (this.animation && this.animation.isAlive) {
            this.animation.stop();
        }
        const startPosition = this.state.viewport.position;
        const startScale = this.state.viewport.scale;
        const deltaPosition = startPosition.subtract(target.position);
        const deltaScale = startScale - target.scale;
        this.animation = animate(150, progress => {
            const newScale = startScale - deltaScale * progress;
            this.state.setViewport({
                position: startPosition.subtract(deltaPosition.multiplyByScalar(progress)),
                scale: newScale
            });
        });
    }
}

class ZoomByWheelCalculator {
    static calculate(controller, current, canvasPosition, e) {
        if (e.deltaY === 0) {
            return null;
        }
        const nextScale = controller.getNextScale(current.scale, e.deltaY < 0);
        let scale;
        const absDeltaY = Math.abs(e.deltaY);
        if (absDeltaY < controller.smoothDeltaYLimit) {
            const fraction = absDeltaY / controller.smoothDeltaYLimit;
            const step = nextScale.next - nextScale.current;
            scale = current.scale + step * fraction;
        }
        else {
            scale = nextScale.next;
        }
        const mousePoint = new Vector(e.pageX, e.pageY).subtract(canvasPosition);
        // The real point is point on canvas with no scale.
        const mouseRealPoint = mousePoint.divideByScalar(current.scale).subtract(current.position.divideByScalar(current.scale));
        const position = mouseRealPoint.multiplyByScalar(-scale).add(mousePoint);
        return { position, scale };
    }
}

class ViewportApi {
    constructor(state, workspaceController, viewportController) {
        this.state = state;
        this.workspaceController = workspaceController;
        this.viewportController = viewportController;
        this.animator = new ViewportAnimator(this.state);
    }
    limitScale(scale) {
        return this.viewportController.limitScale(scale);
    }
    resetViewport() {
        const defaultViewport = this.viewportController.getDefault();
        this.state.setViewport(defaultViewport);
    }
    zoom(direction) {
        const viewport = this.viewportController.getZoomed(direction);
        if (viewport) {
            this.state.setViewport(viewport);
        }
    }
    moveViewportToStep(stepId) {
        const component = this.workspaceController.getComponentByStepId(stepId);
        const canvasPosition = this.workspaceController.getCanvasPosition();
        const clientPosition = component.view.getClientPosition();
        const componentPosition = clientPosition.subtract(canvasPosition);
        const componentSize = new Vector(component.view.width, component.view.height);
        const viewport = this.viewportController.getFocusedOnComponent(componentPosition, componentSize, component.step.componentType, component.view.g);
        this.animator.execute(viewport);
    }
    handleWheelEvent(e) {
        const canvasPosition = this.workspaceController.getCanvasPosition();
        const newViewport = ZoomByWheelCalculator.calculate(this.viewportController, this.state.viewport, canvasPosition, e);
        if (newViewport) {
            this.state.setViewport(newViewport);
        }
    }
}

class WorkspaceApi {
    constructor(state, definitionWalker, workspaceController) {
        this.state = state;
        this.definitionWalker = definitionWalker;
        this.workspaceController = workspaceController;
    }
    getViewport() {
        return this.state.viewport;
    }
    setViewport(viewport) {
        this.state.setViewport(viewport);
    }
    getCanvasPosition() {
        return this.workspaceController.getCanvasPosition();
    }
    getCanvasSize() {
        return this.workspaceController.getCanvasSize();
    }
    getRootComponentSize() {
        return this.workspaceController.getRootComponentSize();
    }
    updateRootComponent() {
        this.workspaceController.updateRootComponent();
    }
    updateBadges() {
        this.workspaceController.updateBadges();
    }
    updateCanvasSize() {
        this.workspaceController.updateCanvasSize();
    }
    getRootSequence() {
        const stepId = this.state.tryGetLastStepIdFromFolderPath();
        if (stepId) {
            const parentStep = this.definitionWalker.getParentSequence(this.state.definition, stepId);
            const children = this.definitionWalker.getChildren(parentStep.step);
            if (!children || children.type !== sequential_workflow_model__WEBPACK_IMPORTED_MODULE_0__.StepChildrenType.sequence) {
                throw new Error('Cannot find single sequence in folder step');
            }
            return {
                sequence: children.items,
                parentStep
            };
        }
        return {
            sequence: this.state.definition.sequence,
            parentStep: null
        };
    }
}

class DesignerApi {
    static create(context) {
        const workspace = new WorkspaceApi(context.state, context.definitionWalker, context.workspaceController);
        const viewportController = context.services.viewportController.create(workspace);
        const toolboxDataProvider = new ToolboxDataProvider(context.i18n, context.componentContext.iconProvider, context.configuration.toolbox);
        return new DesignerApi(context.configuration.shadowRoot, ControlBarApi.create(context.state, context.historyController, context.stateModifier), new ToolboxApi(context.state, context, context.behaviorController, toolboxDataProvider, context.uidGenerator), new EditorApi(context.state, context.definitionWalker, context.stateModifier), workspace, new ViewportApi(context.state, context.workspaceController, viewportController), new PathBarApi(context.state, context.definitionWalker), context.definitionWalker, context.i18n);
    }
    constructor(shadowRoot, controlBar, toolbox, editor, workspace, viewport, pathBar, definitionWalker, i18n) {
        this.shadowRoot = shadowRoot;
        this.controlBar = controlBar;
        this.toolbox = toolbox;
        this.editor = editor;
        this.workspace = workspace;
        this.viewport = viewport;
        this.pathBar = pathBar;
        this.definitionWalker = definitionWalker;
        this.i18n = i18n;
    }
}

const TYPE = 'selectStep';
class SelectStepBehaviorEndToken {
    static is(token) {
        return Boolean(token) && token.type === TYPE;
    }
    constructor(stepId, time) {
        this.stepId = stepId;
        this.time = time;
        this.type = TYPE;
    }
}

const BADGE_GAP = 4;
class DefaultBadgesDecorator {
    constructor(position, badges, g) {
        this.position = position;
        this.badges = badges;
        this.g = g;
    }
    update() {
        let offsetX = 0;
        let maxHeight = 0;
        let j = 0;
        for (let i = 0; i < this.badges.length; i++) {
            const badge = this.badges[i];
            if (badge && badge.view) {
                offsetX += j === 0 ? badge.view.width / 2 : badge.view.width;
                maxHeight = Math.max(maxHeight, badge.view.height);
                Dom.translate(badge.view.g, -offsetX, 0);
                offsetX += BADGE_GAP;
                j++;
            }
        }
        Dom.translate(this.g, this.position.x, this.position.y + -maxHeight / 2);
    }
}

class Badges {
    static createForStep(stepContext, view, componentContext) {
        const g = createG(view.g);
        const badges = componentContext.services.badges.map(ext => ext.createForStep(g, view, stepContext, componentContext));
        const decorator = componentContext.services.stepBadgesDecorator.create(g, view, badges);
        return new Badges(badges, decorator);
    }
    static createForRoot(parentElement, position, componentContext) {
        const g = createG(parentElement);
        const badges = componentContext.services.badges.map(ext => {
            return ext.createForRoot ? ext.createForRoot(g, componentContext) : null;
        });
        const decorator = new DefaultBadgesDecorator(position, badges, g);
        return new Badges(badges, decorator);
    }
    constructor(badges, decorator) {
        this.badges = badges;
        this.decorator = decorator;
    }
    update(result) {
        const count = this.badges.length;
        for (let i = 0; i < count; i++) {
            const badge = this.badges[i];
            if (badge) {
                result[i] = badge.update(result[i]);
            }
        }
        this.decorator.update();
    }
    resolveClick(click) {
        for (const badge of this.badges) {
            const command = badge && badge.resolveClick(click);
            if (command) {
                return command;
            }
        }
        return null;
    }
}
function createG(parentElement) {
    const g = Dom.svg('g', {
        class: 'sqd-badges'
    });
    parentElement.appendChild(g);
    return g;
}

class ValidationErrorBadgeView {
    static create(parent, cfg) {
        const g = Dom.svg('g');
        const halfOfSize = cfg.size / 2;
        const circle = Dom.svg('path', {
            class: 'sqd-validation-error',
            d: `M 0 ${-halfOfSize} l ${halfOfSize} ${cfg.size} l ${-cfg.size} 0 Z`
        });
        Dom.translate(circle, halfOfSize, halfOfSize);
        g.appendChild(circle);
        const icon = Icons.appendPath(g, 'sqd-validation-error-icon-path', Icons.alert, cfg.iconSize);
        const offsetX = (cfg.size - cfg.iconSize) / 2;
        const offsetY = offsetX * 1.5;
        Dom.translate(icon, offsetX, offsetY);
        parent.appendChild(g);
        return new ValidationErrorBadgeView(parent, g, cfg.size, cfg.size);
    }
    constructor(parent, g, width, height) {
        this.parent = parent;
        this.g = g;
        this.width = width;
        this.height = height;
    }
    destroy() {
        this.parent.removeChild(this.g);
    }
}

class ValidatorFactory {
    static createForStep(stepContext, view, componentContext) {
        return () => {
            if (!componentContext.validator.validateStep(stepContext.step, stepContext.parentSequence)) {
                return false;
            }
            if (view.haveCollapsedChildren) {
                let allChildrenValid = true;
                componentContext.definitionWalker.forEachChildren(stepContext.step, (step, _, parentSequence) => {
                    if (!componentContext.validator.validateStep(step, parentSequence)) {
                        allChildrenValid = false;
                        return false;
                    }
                });
                if (!allChildrenValid) {
                    return false;
                }
            }
            return true;
        };
    }
    static createForRoot(componentContext) {
        return () => {
            return componentContext.validator.validateRoot();
        };
    }
}

class ValidationErrorBadge {
    static createForStep(parentElement, view, stepContext, componentContext, configuration) {
        const validator = ValidatorFactory.createForStep(stepContext, view, componentContext);
        return new ValidationErrorBadge(parentElement, validator, configuration);
    }
    static createForRoot(parentElement, componentContext, configuration) {
        const validator = ValidatorFactory.createForRoot(componentContext);
        return new ValidationErrorBadge(parentElement, validator, configuration);
    }
    constructor(parentElement, validator, configuration) {
        this.parentElement = parentElement;
        this.validator = validator;
        this.configuration = configuration;
        this.view = null;
    }
    update(result) {
        const isValid = this.validator();
        if (isValid) {
            if (this.view) {
                this.view.destroy();
                this.view = null;
            }
        }
        else if (!this.view) {
            this.view = ValidationErrorBadgeView.create(this.parentElement, this.configuration);
        }
        return isValid && result;
    }
    resolveClick() {
        return null;
    }
}

const defaultConfiguration$5 = {
    view: {
        size: 22,
        iconSize: 12
    }
};
class ValidationErrorBadgeExtension {
    static create(configuration) {
        return new ValidationErrorBadgeExtension(configuration !== null && configuration !== void 0 ? configuration : defaultConfiguration$5);
    }
    constructor(configuration) {
        this.configuration = configuration;
        this.id = 'validationError';
        this.createStartValue = () => true;
    }
    createForStep(parentElement, view, stepContext, componentContext) {
        return ValidationErrorBadge.createForStep(parentElement, view, stepContext, componentContext, this.configuration.view);
    }
    createForRoot(parentElement, componentContext) {
        return ValidationErrorBadge.createForRoot(parentElement, componentContext, this.configuration.view);
    }
}

class ComponentDom {
    static stepG(componentClassName, type, id) {
        return Dom.svg('g', {
            class: `sqd-step-${componentClassName} sqd-type-${type}`,
            'data-step-id': id
        });
    }
}

class InputView {
    static createRectInput(parent, x, y, size, radius, iconSize, iconUrl) {
        const g = Dom.svg('g');
        parent.appendChild(g);
        const rect = Dom.svg('rect', {
            class: 'sqd-input',
            width: size,
            height: size,
            x: x - size / 2,
            y: y + size / -2 + 0.5,
            rx: radius,
            ry: radius
        });
        g.appendChild(rect);
        if (iconUrl) {
            const icon = Dom.svg('image', {
                href: iconUrl,
                width: iconSize,
                height: iconSize,
                x: x - iconSize / 2,
                y: y + iconSize / -2
            });
            g.appendChild(icon);
        }
        return new InputView(g);
    }
    static createRoundInput(parent, x, y, size) {
        const circle = Dom.svg('circle', {
            class: 'sqd-input',
            cx: x,
            xy: y,
            r: size / 2
        });
        parent.appendChild(circle);
        return new InputView(circle);
    }
    constructor(g) {
        this.g = g;
    }
    setIsHidden(isHidden) {
        Dom.attrs(this.g, {
            visibility: isHidden ? 'hidden' : 'visible'
        });
    }
}

const EPS = 0.5; // Epsilon, a tiny offset to avoid rendering issues
class JoinView {
    static createStraightJoin(parent, start, height) {
        const dy = Math.sign(height);
        const join = Dom.svg('line', {
            class: 'sqd-join',
            x1: start.x,
            y1: start.y - EPS * dy,
            x2: start.x,
            y2: start.y + height + EPS * dy
        });
        parent.insertBefore(join, parent.firstChild);
    }
    static createJoins(parent, start, targets) {
        const firstTarget = targets[0];
        const h = Math.abs(firstTarget.y - start.y) / 2; // half height
        const dy = Math.sign(firstTarget.y - start.y); // direction y
        switch (targets.length) {
            case 1:
                if (start.x === targets[0].x) {
                    JoinView.createStraightJoin(parent, start, h * 2 * dy);
                }
                else {
                    appendCurvedJoins(parent, start, targets, h, dy);
                }
                break;
            case 2:
                appendCurvedJoins(parent, start, targets, h, dy);
                break;
            default:
                {
                    const f = targets[0]; // first
                    const l = targets[targets.length - 1]; // last
                    const eps = EPS * dy;
                    appendJoin(parent, `M ${f.x} ${f.y + eps} l 0 ${-eps} q ${h * 0.3} ${h * -dy * 0.8} ${h} ${h * -dy} ` +
                        `l ${l.x - f.x - h * 2} 0 q ${h * 0.8} ${-h * -dy * 0.3} ${h} ${-h * -dy} l 0 ${eps}`);
                    for (let i = 1; i < targets.length - 1; i++) {
                        JoinView.createStraightJoin(parent, targets[i], h * -dy);
                    }
                    JoinView.createStraightJoin(parent, start, h * dy);
                }
                break;
        }
    }
}
function appendCurvedJoins(parent, start, targets, h, dy) {
    const eps = EPS * dy;
    for (const target of targets) {
        const l = Math.abs(target.x - start.x) - h * 2; // straight line length
        const dx = Math.sign(target.x - start.x); // direction x
        appendJoin(parent, `M ${start.x} ${start.y - eps} l 0 ${eps} q ${dx * h * 0.3} ${dy * h * 0.8} ${dx * h} ${dy * h} ` +
            `l ${dx * l} 0 q ${dx * h * 0.7} ${dy * h * 0.2} ${dx * h} ${dy * h} l 0 ${eps}`);
    }
}
function appendJoin(parent, d) {
    const join = Dom.svg('path', {
        class: 'sqd-join',
        fill: 'none',
        d
    });
    parent.insertBefore(join, parent.firstChild);
}

class LabelView {
    static create(parent, y, cfg, text, theme) {
        const g = Dom.svg('g', {
            class: `sqd-label sqd-label-${theme}`
        });
        parent.appendChild(g);
        const nameText = Dom.svg('text', {
            class: 'sqd-label-text',
            y: y + cfg.height / 2
        });
        nameText.textContent = text;
        g.appendChild(nameText);
        const width = Math.max(nameText.getBBox().width + cfg.paddingX * 2, cfg.minWidth);
        const nameRect = Dom.svg('rect', {
            class: 'sqd-label-rect',
            width: width,
            height: cfg.height,
            x: -width / 2 + 0.5,
            y: y + 0.5,
            rx: cfg.radius,
            ry: cfg.radius
        });
        g.insertBefore(nameRect, nameText);
        return new LabelView(g, width, cfg.height);
    }
    constructor(g, width, height) {
        this.g = g;
        this.width = width;
        this.height = height;
    }
}

class OutputView {
    static create(parent, x, y, size) {
        const circle = Dom.svg('circle', {
            class: 'sqd-output',
            cx: x,
            cy: y,
            r: size / 2
        });
        parent.appendChild(circle);
        return new OutputView(circle);
    }
    constructor(root) {
        this.root = root;
    }
    setIsHidden(isHidden) {
        Dom.attrs(this.root, {
            visibility: isHidden ? 'hidden' : 'visible'
        });
    }
}

// PlaceholderExtension
var PlaceholderGapOrientation;
(function (PlaceholderGapOrientation) {
    PlaceholderGapOrientation[PlaceholderGapOrientation["along"] = 0] = "along";
    PlaceholderGapOrientation[PlaceholderGapOrientation["perpendicular"] = 1] = "perpendicular"; // Goes perpendicular to the flow
})(PlaceholderGapOrientation || (PlaceholderGapOrientation = {}));

class DefaultSequenceComponentView {
    static create(parent, sequenceContext, componentContext) {
        const phSize = componentContext.services.placeholder.getGapSize(PlaceholderGapOrientation.along);
        const phWidth = phSize.x;
        const phHeight = phSize.y;
        const { sequence } = sequenceContext;
        const g = Dom.svg('g');
        parent.appendChild(g);
        const components = [];
        for (let index = 0; index < sequence.length; index++) {
            const stepContext = {
                parentSequence: sequenceContext.sequence,
                step: sequence[index],
                depth: sequenceContext.depth,
                position: index,
                isInputConnected: index === 0 ? sequenceContext.isInputConnected : components[index - 1].hasOutput,
                isOutputConnected: index === sequence.length - 1 ? sequenceContext.isOutputConnected : true,
                isPreview: sequenceContext.isPreview
            };
            components[index] = componentContext.stepComponentFactory.create(g, stepContext, componentContext);
        }
        let joinX;
        let totalWidth;
        if (components.length > 0) {
            const restWidth = Math.max(...components.map(c => c.view.width - c.view.joinX));
            joinX = Math.max(...components.map(c => c.view.joinX));
            totalWidth = joinX + restWidth;
        }
        else {
            joinX = phWidth / 2;
            totalWidth = phWidth;
        }
        let offsetY = phHeight;
        const placeholders = [];
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            const offsetX = joinX - component.view.joinX;
            if ((i === 0 && sequenceContext.isInputConnected) || (i > 0 && components[i - 1].hasOutput)) {
                JoinView.createStraightJoin(g, new Vector(joinX, offsetY - phHeight), phHeight);
            }
            if (!sequenceContext.isPreview && componentContext.placeholderController.canCreate(sequence, i)) {
                const ph = componentContext.services.placeholder.createForGap(g, sequence, i, PlaceholderGapOrientation.along);
                Dom.translate(ph.view.g, joinX - phWidth / 2, offsetY - phHeight);
                placeholders.push(ph);
            }
            Dom.translate(component.view.g, offsetX, offsetY);
            offsetY += component.view.height + phHeight;
        }
        if (sequenceContext.isOutputConnected && (components.length === 0 || components[components.length - 1].hasOutput)) {
            JoinView.createStraightJoin(g, new Vector(joinX, offsetY - phHeight), phHeight);
        }
        const newIndex = components.length;
        if (!sequenceContext.isPreview && componentContext.placeholderController.canCreate(sequence, newIndex)) {
            const ph = componentContext.services.placeholder.createForGap(g, sequence, newIndex, PlaceholderGapOrientation.along);
            Dom.translate(ph.view.g, joinX - phWidth / 2, offsetY - phHeight);
            placeholders.push(ph);
        }
        return new DefaultSequenceComponentView(g, totalWidth, offsetY, joinX, placeholders, components);
    }
    constructor(g, width, height, joinX, placeholders, components) {
        this.g = g;
        this.width = width;
        this.height = height;
        this.joinX = joinX;
        this.placeholders = placeholders;
        this.components = components;
    }
    hasOutput() {
        if (this.components.length > 0) {
            return this.components[this.components.length - 1].hasOutput;
        }
        return true;
    }
}

class DefaultSequenceComponent {
    static create(parentElement, sequenceContext, context) {
        const view = DefaultSequenceComponentView.create(parentElement, sequenceContext, context);
        return new DefaultSequenceComponent(view, view.hasOutput());
    }
    constructor(view, hasOutput) {
        this.view = view;
        this.hasOutput = hasOutput;
    }
    resolveClick(click) {
        for (const component of this.view.components) {
            const result = component.resolveClick(click);
            if (result) {
                return result;
            }
        }
        for (const placeholder of this.view.placeholders) {
            const result = placeholder.resolveClick(click);
            if (result) {
                return result;
            }
        }
        return null;
    }
    findById(stepId) {
        for (const component of this.view.components) {
            const result = component.findById(stepId);
            if (result) {
                return result;
            }
        }
        return null;
    }
    resolvePlaceholders(skipComponent, result) {
        this.view.components.forEach(component => component.resolvePlaceholders(skipComponent, result));
        this.view.placeholders.forEach(placeholder => result.placeholders.push(placeholder));
    }
    updateBadges(result) {
        this.view.components.forEach(component => component.updateBadges(result));
    }
}

var ClickCommandType;
(function (ClickCommandType) {
    ClickCommandType[ClickCommandType["selectStep"] = 1] = "selectStep";
    ClickCommandType[ClickCommandType["rerenderStep"] = 2] = "rerenderStep";
    ClickCommandType[ClickCommandType["openFolder"] = 3] = "openFolder";
    ClickCommandType[ClickCommandType["triggerCustomAction"] = 4] = "triggerCustomAction";
})(ClickCommandType || (ClickCommandType = {}));
var PlaceholderDirection;
(function (PlaceholderDirection) {
    PlaceholderDirection[PlaceholderDirection["in"] = 1] = "in";
    PlaceholderDirection[PlaceholderDirection["out"] = 2] = "out";
})(PlaceholderDirection || (PlaceholderDirection = {}));

class StartStopRootComponentView {
    static create(parent, sequence, parentPlaceIndicator, context, cfg) {
        const g = Dom.svg('g', {
            class: 'sqd-root-start-stop'
        });
        parent.appendChild(g);
        const sequenceComponent = DefaultSequenceComponent.create(g, {
            sequence,
            depth: 0,
            isInputConnected: Boolean(cfg.start),
            isOutputConnected: true,
            isPreview: false
        }, context);
        const view = sequenceComponent.view;
        const x = view.joinX - cfg.size / 2;
        const endY = cfg.size + view.height;
        const iconSize = parentPlaceIndicator ? cfg.folderIconSize : cfg.defaultIconSize;
        if (cfg.start) {
            const startCircle = createCircle('start', parentPlaceIndicator ? cfg.folderIconD : cfg.start.iconD, cfg.size, iconSize);
            Dom.translate(startCircle, x, 0);
            g.appendChild(startCircle);
        }
        Dom.translate(view.g, 0, cfg.size);
        const stopCircle = createCircle('stop', parentPlaceIndicator ? cfg.folderIconD : cfg.stopIconD, cfg.size, iconSize);
        Dom.translate(stopCircle, x, endY);
        g.appendChild(stopCircle);
        let startPlaceholder = null;
        let endPlaceholder = null;
        if (parentPlaceIndicator) {
            const size = new Vector(cfg.size, cfg.size);
            startPlaceholder = context.services.placeholder.createForArea(g, size, PlaceholderDirection.out, parentPlaceIndicator.sequence, parentPlaceIndicator.index);
            endPlaceholder = context.services.placeholder.createForArea(g, size, PlaceholderDirection.out, parentPlaceIndicator.sequence, parentPlaceIndicator.index);
            Dom.translate(startPlaceholder.view.g, x, 0);
            Dom.translate(endPlaceholder.view.g, x, endY);
        }
        const badges = Badges.createForRoot(g, new Vector(x + cfg.size, 0), context);
        return new StartStopRootComponentView(g, view.width, view.height + cfg.size * 2, view.joinX, sequenceComponent, startPlaceholder, endPlaceholder, badges);
    }
    constructor(g, width, height, joinX, component, startPlaceholder, endPlaceholder, badges) {
        this.g = g;
        this.width = width;
        this.height = height;
        this.joinX = joinX;
        this.component = component;
        this.startPlaceholder = startPlaceholder;
        this.endPlaceholder = endPlaceholder;
        this.badges = badges;
    }
    destroy() {
        var _a;
        (_a = this.g.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(this.g);
    }
}
function createCircle(classSuffix, d, size, iconSize) {
    const g = Dom.svg('g', {
        class: 'sqd-root-start-stop-' + classSuffix
    });
    const r = size / 2;
    const circle = Dom.svg('circle', {
        class: 'sqd-root-start-stop-circle',
        cx: r,
        cy: r,
        r: r
    });
    g.appendChild(circle);
    const offset = (size - iconSize) / 2;
    const icon = Icons.appendPath(g, 'sqd-root-start-stop-icon', d, iconSize);
    Dom.translate(icon, offset, offset);
    return g;
}

class StartStopRootComponent {
    static create(parentElement, sequence, parentPlaceIndicator, context, viewConfiguration) {
        const view = StartStopRootComponentView.create(parentElement, sequence, parentPlaceIndicator, context, viewConfiguration);
        return new StartStopRootComponent(view);
    }
    constructor(view) {
        this.view = view;
    }
    resolveClick(click) {
        return this.view.component.resolveClick(click);
    }
    findById(stepId) {
        return this.view.component.findById(stepId);
    }
    resolvePlaceholders(skipComponent, result) {
        this.view.component.resolvePlaceholders(skipComponent, result);
        if (this.view.startPlaceholder && this.view.endPlaceholder) {
            result.placeholders.push(this.view.startPlaceholder);
            result.placeholders.push(this.view.endPlaceholder);
        }
    }
    updateBadges(result) {
        this.view.badges.update(result);
        this.view.component.updateBadges(result);
    }
}

const defaultViewConfiguration$2 = {
    size: 30,
    defaultIconSize: 22,
    folderIconSize: 18,
    start: {
        iconD: Icons.play
    },
    stopIconD: Icons.stop,
    folderIconD: Icons.folder
};
class StartStopRootComponentExtension {
    static create(configuration) {
        return new StartStopRootComponentExtension(configuration);
    }
    constructor(configuration) {
        this.configuration = configuration;
    }
    create(parentElement, sequence, parentPlaceIndicator, context) {
        var _a;
        const view = ((_a = this.configuration) === null || _a === void 0 ? void 0 : _a.view) ? Object.assign(Object.assign({}, defaultViewConfiguration$2), this.configuration.view) : defaultViewConfiguration$2;
        return StartStopRootComponent.create(parentElement, sequence, parentPlaceIndicator, context, view);
    }
}

const COMPONENT_CLASS_NAME$3 = 'container';
const createContainerStepComponentViewFactory = (cfg) => (parentElement, stepContext, viewContext) => {
    return viewContext.createRegionComponentView(parentElement, COMPONENT_CLASS_NAME$3, (g, regionViewBuilder) => {
        const step = stepContext.step;
        const name = viewContext.getStepName();
        const labelView = LabelView.create(g, cfg.paddingTop, cfg.label, name, 'primary');
        const sequenceComponent = viewContext.createSequenceComponent(g, step.sequence);
        const halfOfWidestElement = labelView.width / 2;
        const offsetLeft = Math.max(halfOfWidestElement - sequenceComponent.view.joinX, 0) + cfg.paddingX;
        const offsetRight = Math.max(halfOfWidestElement - (sequenceComponent.view.width - sequenceComponent.view.joinX), 0) + cfg.paddingX;
        const width = offsetLeft + sequenceComponent.view.width + offsetRight;
        const height = cfg.paddingTop + cfg.label.height + sequenceComponent.view.height;
        const joinX = sequenceComponent.view.joinX + offsetLeft;
        Dom.translate(labelView.g, joinX, 0);
        Dom.translate(sequenceComponent.view.g, offsetLeft, cfg.paddingTop + cfg.label.height);
        let inputView = null;
        if (cfg.inputSize > 0) {
            const iconUrl = viewContext.getStepIconUrl();
            inputView = InputView.createRectInput(g, joinX, 0, cfg.inputSize, cfg.inputRadius, cfg.inputIconSize, iconUrl);
        }
        JoinView.createStraightJoin(g, new Vector(joinX, 0), cfg.paddingTop);
        const regionView = regionViewBuilder(g, [width], height);
        return {
            g,
            width,
            height,
            joinX,
            placeholders: null,
            components: [sequenceComponent],
            hasOutput: sequenceComponent.hasOutput,
            getClientPosition() {
                return regionView.getClientPosition();
            },
            resolveClick(click) {
                if (cfg.isRegionClickable) {
                    const result = regionView.resolveClick(click);
                    if (result !== null) {
                        return result;
                    }
                }
                return labelView.g.contains(click.element) || (inputView && inputView.g.contains(click.element)) ? true : null;
            },
            setIsDragging(isDragging) {
                if (inputView && cfg.autoHideInputOnDrag) {
                    inputView.setIsHidden(isDragging);
                }
            },
            setIsSelected(isSelected) {
                regionView.setIsSelected(isSelected);
            },
            setIsDisabled(isDisabled) {
                Dom.toggleClass(g, isDisabled, 'sqd-disabled');
            }
        };
    });
};

const COMPONENT_CLASS_NAME$2 = 'launch-pad';
function createView$1(parentElement, stepContext, viewContext, regionViewFactory, isInterruptedIfEmpty, cfg) {
    const step = stepContext.step;
    const sequence = stepContext.step.sequence;
    const g = ComponentDom.stepG(COMPONENT_CLASS_NAME$2, step.type, step.id);
    parentElement.appendChild(g);
    const components = [];
    let width;
    let height;
    let joinX;
    const placeholdersX = [];
    let placeholderOrientation;
    let placeholderSize;
    let hasOutput;
    let inputView = null;
    let outputView = null;
    if (sequence.length > 0) {
        let maxComponentHeight = 0;
        for (let i = 0; i < sequence.length; i++) {
            const component = viewContext.createStepComponent(g, sequence, sequence[i], i);
            components.push(component);
            maxComponentHeight = Math.max(maxComponentHeight, component.view.height);
        }
        const joinsX = [];
        const positionsX = [];
        const spacesY = [];
        placeholderOrientation = PlaceholderGapOrientation.perpendicular;
        placeholderSize = viewContext.getPlaceholderGapSize(placeholderOrientation);
        placeholdersX.push(0);
        let positionX = placeholderSize.x;
        for (let i = 0; i < components.length; i++) {
            if (i > 0) {
                placeholdersX.push(positionX);
                positionX += placeholderSize.x;
            }
            const component = components[i];
            const componentY = (maxComponentHeight - component.view.height) / 2 + cfg.connectionHeight + cfg.paddingY;
            Dom.translate(component.view.g, positionX, componentY);
            joinsX.push(positionX + component.view.joinX);
            positionX += component.view.width;
            positionsX.push(positionX);
            spacesY.push(Math.max(0, (maxComponentHeight - component.view.height) / 2));
        }
        placeholdersX.push(positionX);
        positionX += placeholderSize.x;
        width = positionX;
        height = maxComponentHeight + 2 * cfg.connectionHeight + 2 * cfg.paddingY;
        const contentJoinX = components.length % 2 === 0
            ? positionsX[Math.max(0, Math.floor(components.length / 2) - 1)] + placeholderSize.x / 2
            : joinsX[Math.floor(components.length / 2)];
        if (stepContext.isInputConnected) {
            const joinsTopY = joinsX.map(x => new Vector(x, cfg.connectionHeight));
            JoinView.createJoins(g, new Vector(contentJoinX, 0), joinsTopY);
            for (let i = 0; i < joinsX.length; i++) {
                JoinView.createStraightJoin(g, joinsTopY[i], cfg.paddingY + spacesY[i]);
            }
        }
        const joinsBottomY = joinsX.map(x => new Vector(x, cfg.connectionHeight + 2 * cfg.paddingY + maxComponentHeight));
        JoinView.createJoins(g, new Vector(contentJoinX, height), joinsBottomY);
        for (let i = 0; i < joinsX.length; i++) {
            JoinView.createStraightJoin(g, joinsBottomY[i], -(cfg.paddingY + spacesY[i]));
        }
        hasOutput = true;
        joinX = contentJoinX;
    }
    else {
        placeholderOrientation = PlaceholderGapOrientation.along;
        placeholderSize = viewContext.getPlaceholderGapSize(placeholderOrientation);
        placeholdersX.push(cfg.emptyPaddingX);
        width = placeholderSize.x + cfg.emptyPaddingX * 2;
        height = placeholderSize.y + cfg.emptyPaddingY * 2;
        hasOutput = !isInterruptedIfEmpty;
        if (stepContext.isInputConnected) {
            inputView = InputView.createRoundInput(g, width / 2, 0, cfg.emptyInputSize);
        }
        if (stepContext.isOutputConnected && hasOutput) {
            outputView = OutputView.create(g, width / 2, height, cfg.emptyOutputSize);
        }
        if (cfg.emptyIconSize > 0) {
            const iconUrl = viewContext.getStepIconUrl();
            if (iconUrl) {
                const icon = Dom.svg('image', {
                    href: iconUrl,
                    x: (width - cfg.emptyIconSize) / 2,
                    y: (height - cfg.emptyIconSize) / 2,
                    width: cfg.emptyIconSize,
                    height: cfg.emptyIconSize
                });
                g.appendChild(icon);
            }
        }
        joinX = width / 2;
    }
    let regionView = null;
    if (regionViewFactory) {
        regionView = regionViewFactory(g, [width], height);
    }
    const placeholders = [];
    const placeholderY = (height - placeholderSize.y) / 2;
    for (let i = 0; i < placeholdersX.length; i++) {
        const placeholder = viewContext.createPlaceholderForGap(g, sequence, i, placeholderOrientation);
        placeholders.push(placeholder);
        Dom.translate(placeholder.view.g, placeholdersX[i], placeholderY);
    }
    return {
        g,
        width,
        height,
        joinX,
        components,
        placeholders,
        hasOutput,
        getClientPosition() {
            return getAbsolutePosition(g);
        },
        resolveClick(click) {
            if (regionView) {
                const result = regionView.resolveClick(click);
                return result === true || (result === null && g.contains(click.element)) ? true : result;
            }
            return null;
        },
        setIsDragging(isDragging) {
            inputView === null || inputView === void 0 ? void 0 : inputView.setIsHidden(isDragging);
            outputView === null || outputView === void 0 ? void 0 : outputView.setIsHidden(isDragging);
        },
        setIsDisabled(isDisabled) {
            Dom.toggleClass(g, isDisabled, 'sqd-disabled');
        },
        setIsSelected(isSelected) {
            regionView === null || regionView === void 0 ? void 0 : regionView.setIsSelected(isSelected);
        }
    };
}
const createLaunchPadStepComponentViewFactory = (isInterruptedIfEmpty, cfg) => (parentElement, stepContext, viewContext) => {
    if (cfg.isRegionEnabled) {
        return viewContext.createRegionComponentView(parentElement, COMPONENT_CLASS_NAME$2, (g, regionViewBuilder) => {
            return createView$1(g, stepContext, viewContext, regionViewBuilder, isInterruptedIfEmpty, cfg);
        });
    }
    return createView$1(parentElement, stepContext, viewContext, null, isInterruptedIfEmpty, cfg);
};

const COMPONENT_CLASS_NAME$1 = 'switch';
function createView(g, width, height, joinX, viewContext, sequenceComponents, labelViews, regionView, cfg) {
    let inputView = null;
    if (cfg.inputSize > 0) {
        const iconUrl = viewContext.getStepIconUrl();
        inputView = InputView.createRectInput(g, joinX, cfg.paddingTop1, cfg.inputSize, cfg.inputRadius, cfg.inputIconSize, iconUrl);
    }
    return {
        g,
        width,
        height,
        joinX,
        placeholders: null,
        components: sequenceComponents,
        hasOutput: sequenceComponents ? sequenceComponents.some(c => c.hasOutput) : true,
        getClientPosition() {
            return regionView.getClientPosition();
        },
        resolveClick(click) {
            if (cfg.isRegionClickable) {
                const result = regionView.resolveClick(click);
                if (result !== null) {
                    return result;
                }
            }
            return labelViews.some(v => v.g.contains(click.element) || (inputView && inputView.g.contains(click.element))) ? true : null;
        },
        setIsDragging(isDragging) {
            if (inputView && cfg.autoHideInputOnDrag) {
                inputView.setIsHidden(isDragging);
            }
        },
        setIsSelected(isSelected) {
            regionView.setIsSelected(isSelected);
        },
        setIsDisabled(isDisabled) {
            Dom.toggleClass(g, isDisabled, 'sqd-disabled');
        }
    };
}
const createSwitchStepComponentViewFactory = (cfg, branchNameResolver) => (parent, stepContext, viewContext) => {
    return viewContext.createRegionComponentView(parent, COMPONENT_CLASS_NAME$1, (g, regionViewBuilder) => {
        const step = stepContext.step;
        const paddingTop = cfg.paddingTop1 + cfg.paddingTop2;
        const name = viewContext.getStepName();
        const nameLabelView = LabelView.create(g, paddingTop, cfg.nameLabel, name, 'primary');
        const branchNames = branchNameResolver ? branchNameResolver(step) : Object.keys(step.branches);
        if (branchNames.length === 0) {
            const width = Math.max(nameLabelView.width, cfg.minBranchWidth) + cfg.paddingX * 2;
            const height = nameLabelView.height + paddingTop + cfg.noBranchPaddingBottom;
            const joinX = width / 2;
            const regionView = regionViewBuilder(g, [width], height);
            Dom.translate(nameLabelView.g, joinX, 0);
            JoinView.createStraightJoin(g, new Vector(joinX, 0), height);
            return createView(g, width, height, joinX, viewContext, null, [nameLabelView], regionView, cfg);
        }
        const branchComponents = new Array(branchNames.length);
        const branchSizes = new Array(branchNames.length);
        const labelViews = new Array(branchNames.length + 1);
        labelViews[branchNames.length] = nameLabelView;
        let totalBranchesWidth = 0;
        let maxBranchesHeight = 0;
        branchNames.forEach((branchName, i) => {
            const labelY = paddingTop + cfg.nameLabel.height + cfg.connectionHeight;
            const translatedBranchName = viewContext.i18n(`stepComponent.${step.type}.branchName`, branchName);
            const labelView = LabelView.create(g, labelY, cfg.branchNameLabel, translatedBranchName, 'secondary');
            const component = viewContext.createSequenceComponent(g, step.branches[branchName]);
            const halfOfWidestBranchElement = Math.max(labelView.width, cfg.minBranchWidth) / 2;
            const branchOffsetLeft = Math.max(halfOfWidestBranchElement - component.view.joinX, 0) + cfg.paddingX;
            const branchOffsetRight = Math.max(halfOfWidestBranchElement - (component.view.width - component.view.joinX), 0) + cfg.paddingX;
            const width = component.view.width + branchOffsetLeft + branchOffsetRight;
            const joinX = component.view.joinX + branchOffsetLeft;
            const offsetX = totalBranchesWidth;
            totalBranchesWidth += width;
            maxBranchesHeight = Math.max(maxBranchesHeight, component.view.height);
            branchComponents[i] = component;
            branchSizes[i] = { width, branchOffsetLeft, offsetX, joinX };
            labelViews[i] = labelView;
        });
        const centerBranchIndex = Math.floor(branchNames.length / 2);
        const centerBranchSize = branchSizes[centerBranchIndex];
        let joinX = centerBranchSize.offsetX;
        if (branchNames.length % 2 !== 0) {
            joinX += centerBranchSize.joinX;
        }
        const halfOfWidestSwitchElement = nameLabelView.width / 2 + cfg.paddingX;
        const switchOffsetLeft = Math.max(halfOfWidestSwitchElement - joinX, 0);
        const switchOffsetRight = Math.max(halfOfWidestSwitchElement - (totalBranchesWidth - joinX), 0);
        const viewWidth = switchOffsetLeft + totalBranchesWidth + switchOffsetRight;
        const viewHeight = maxBranchesHeight + paddingTop + cfg.nameLabel.height + cfg.branchNameLabel.height + cfg.connectionHeight * 2;
        const shiftedJoinX = switchOffsetLeft + joinX;
        Dom.translate(nameLabelView.g, shiftedJoinX, 0);
        const branchOffsetTop = paddingTop + cfg.nameLabel.height + cfg.branchNameLabel.height + cfg.connectionHeight;
        branchComponents.forEach((component, i) => {
            const branchSize = branchSizes[i];
            const branchOffsetLeft = switchOffsetLeft + branchSize.offsetX + branchSize.branchOffsetLeft;
            Dom.translate(labelViews[i].g, switchOffsetLeft + branchSize.offsetX + branchSize.joinX, 0);
            Dom.translate(component.view.g, branchOffsetLeft, branchOffsetTop);
            if (component.hasOutput && stepContext.isOutputConnected) {
                const endOffsetTopOfComponent = paddingTop + cfg.nameLabel.height + cfg.branchNameLabel.height + cfg.connectionHeight + component.view.height;
                const missingHeight = viewHeight - endOffsetTopOfComponent - cfg.connectionHeight;
                if (missingHeight > 0) {
                    JoinView.createStraightJoin(g, new Vector(switchOffsetLeft + branchSize.offsetX + branchSize.joinX, endOffsetTopOfComponent), missingHeight);
                }
            }
        });
        JoinView.createStraightJoin(g, new Vector(shiftedJoinX, 0), paddingTop);
        JoinView.createJoins(g, new Vector(shiftedJoinX, paddingTop + cfg.nameLabel.height), branchSizes.map(s => new Vector(switchOffsetLeft + s.offsetX + s.joinX, paddingTop + cfg.nameLabel.height + cfg.connectionHeight)));
        if (stepContext.isOutputConnected) {
            const ongoingSequenceIndexes = branchComponents
                .map((component, index) => (component.hasOutput ? index : null))
                .filter(index => index !== null);
            const ongoingJoinTargets = ongoingSequenceIndexes.map((i) => {
                const branchSize = branchSizes[i];
                return new Vector(switchOffsetLeft + branchSize.offsetX + branchSize.joinX, paddingTop + cfg.connectionHeight + cfg.nameLabel.height + cfg.branchNameLabel.height + maxBranchesHeight);
            });
            if (ongoingJoinTargets.length > 0) {
                JoinView.createJoins(g, new Vector(shiftedJoinX, viewHeight), ongoingJoinTargets);
            }
        }
        const regions = branchSizes.map(s => s.width);
        regions[0] += switchOffsetLeft;
        regions[regions.length - 1] += switchOffsetRight;
        const regionView = regionViewBuilder(g, regions, viewHeight);
        return createView(g, viewWidth, viewHeight, shiftedJoinX, viewContext, branchComponents, labelViews, regionView, cfg);
    });
};

const COMPONENT_CLASS_NAME = 'task';
const createTaskStepComponentViewFactory = (isInterrupted, cfg) => (parentElement, stepContext, viewContext) => {
    const { step } = stepContext;
    const g = ComponentDom.stepG(COMPONENT_CLASS_NAME, step.type, step.id);
    parentElement.appendChild(g);
    const boxHeight = cfg.paddingY * 2 + cfg.iconSize;
    const text = Dom.svg('text', {
        x: cfg.paddingLeft + cfg.iconSize + cfg.textMarginLeft,
        y: boxHeight / 2,
        class: 'sqd-step-task-text'
    });
    text.textContent = viewContext.getStepName();
    g.appendChild(text);
    const textWidth = Math.max(text.getBBox().width, cfg.minTextWidth);
    const boxWidth = cfg.iconSize + cfg.paddingLeft + cfg.paddingRight + cfg.textMarginLeft + textWidth;
    const rect = Dom.svg('rect', {
        x: 0.5,
        y: 0.5,
        class: 'sqd-step-task-rect',
        width: boxWidth,
        height: boxHeight,
        rx: cfg.radius,
        ry: cfg.radius
    });
    g.insertBefore(rect, text);
    const iconUrl = viewContext.getStepIconUrl();
    const icon = iconUrl
        ? Dom.svg('image', {
            href: iconUrl
        })
        : Dom.svg('rect', {
            class: 'sqd-step-task-empty-icon',
            rx: cfg.radius,
            ry: cfg.radius
        });
    Dom.attrs(icon, {
        x: cfg.paddingLeft,
        y: cfg.paddingY,
        width: cfg.iconSize,
        height: cfg.iconSize
    });
    g.appendChild(icon);
    const isInputViewHidden = !stepContext.isInputConnected; // TODO: handle inside the folder
    const isOutputViewHidden = isInterrupted;
    const inputView = isInputViewHidden ? null : InputView.createRoundInput(g, boxWidth / 2, 0, cfg.inputSize);
    const outputView = isOutputViewHidden ? null : OutputView.create(g, boxWidth / 2, boxHeight, cfg.outputSize);
    return {
        g,
        width: boxWidth,
        height: boxHeight,
        joinX: boxWidth / 2,
        components: null,
        placeholders: null,
        hasOutput: !!outputView,
        getClientPosition() {
            return getAbsolutePosition(rect);
        },
        resolveClick(click) {
            return g.contains(click.element) ? true : null;
        },
        setIsDragging(isDragging) {
            inputView === null || inputView === void 0 ? void 0 : inputView.setIsHidden(isDragging);
            outputView === null || outputView === void 0 ? void 0 : outputView.setIsHidden(isDragging);
        },
        setIsDisabled(isDisabled) {
            Dom.toggleClass(g, isDisabled, 'sqd-disabled');
        },
        setIsSelected(isSelected) {
            Dom.toggleClass(rect, isSelected, 'sqd-selected');
        }
    };
};

class CenteredViewportCalculator {
    static center(padding, canvasSize, rootComponentSize) {
        if (canvasSize.x === 0 || canvasSize.y === 0) {
            return {
                position: new Vector(0, 0),
                scale: 1
            };
        }
        const canvasSafeWidth = Math.max(canvasSize.x - padding * 2, 0);
        const canvasSafeHeight = Math.max(canvasSize.y - padding * 2, 0);
        const scale = Math.min(Math.min(canvasSafeWidth / rootComponentSize.x, canvasSafeHeight / rootComponentSize.y), 1);
        const width = rootComponentSize.x * scale;
        const height = rootComponentSize.y * scale;
        const x = Math.max(0, (canvasSize.x - width) / 2);
        const y = Math.max(0, (canvasSize.y - height) / 2);
        return {
            position: new Vector(x, y),
            scale
        };
    }
    static getFocusedOnComponent(canvasSize, viewport, componentPosition, componentSize) {
        const realPosition = viewport.position.divideByScalar(viewport.scale).subtract(componentPosition.divideByScalar(viewport.scale));
        const componentOffset = componentSize.divideByScalar(2);
        const position = realPosition.add(canvasSize.divideByScalar(2)).subtract(componentOffset);
        return { position, scale: 1 };
    }
}

class ClassicWheelController {
    static create(api) {
        return new ClassicWheelController(api);
    }
    constructor(api) {
        this.api = api;
    }
    onWheel(e) {
        this.api.handleWheelEvent(e);
    }
}

class ClassicWheelControllerExtension {
    constructor() {
        this.create = ClassicWheelController.create;
    }
}

class NextQuantifiedNumber {
    constructor(values) {
        this.values = values;
    }
    next(value, direction) {
        let bestIndex = 0;
        let bestDistance = Number.MAX_VALUE;
        for (let i = 0; i < this.values.length; i++) {
            const distance = Math.abs(this.values[i] - value);
            if (bestDistance > distance) {
                bestIndex = i;
                bestDistance = distance;
            }
        }
        let index;
        if (direction) {
            index = Math.min(bestIndex + 1, this.values.length - 1);
        }
        else {
            index = Math.max(bestIndex - 1, 0);
        }
        return {
            current: this.values[bestIndex],
            next: this.values[index]
        };
    }
    limit(scale) {
        const min = this.values[0];
        const max = this.values[this.values.length - 1];
        return Math.min(Math.max(scale, min), max);
    }
}

const defaultConfiguration$4 = {
    scales: [0.06, 0.08, 0.1, 0.12, 0.16, 0.2, 0.26, 0.32, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    smoothDeltaYLimit: 16,
    padding: 10
};
class DefaultViewportController {
    static create(api, configuration) {
        const config = configuration !== null && configuration !== void 0 ? configuration : defaultConfiguration$4;
        const nqn = new NextQuantifiedNumber(config.scales);
        return new DefaultViewportController(config.smoothDeltaYLimit, nqn, api, config.padding);
    }
    constructor(smoothDeltaYLimit, nqn, api, padding) {
        this.smoothDeltaYLimit = smoothDeltaYLimit;
        this.nqn = nqn;
        this.api = api;
        this.padding = padding;
    }
    getDefault() {
        const rootComponentSize = this.api.getRootComponentSize();
        const canvasSize = this.api.getCanvasSize();
        return CenteredViewportCalculator.center(this.padding, canvasSize, rootComponentSize);
    }
    getZoomed(direction) {
        const current = this.api.getViewport();
        const nextScale = this.nqn.next(current.scale, direction);
        if (nextScale) {
            return {
                position: current.position,
                scale: nextScale.next
            };
        }
        return null;
    }
    getFocusedOnComponent(componentPosition, componentSize) {
        const viewport = this.api.getViewport();
        const canvasSize = this.api.getCanvasSize();
        return CenteredViewportCalculator.getFocusedOnComponent(canvasSize, viewport, componentPosition, componentSize);
    }
    getNextScale(scale, direction) {
        return this.nqn.next(scale, direction);
    }
    limitScale(scale) {
        return this.nqn.limit(scale);
    }
}

class DefaultViewportControllerExtension {
    static create(configuration) {
        return new DefaultViewportControllerExtension(configuration);
    }
    constructor(configuration) {
        this.configuration = configuration;
    }
    create(api) {
        return DefaultViewportController.create(api, this.configuration);
    }
}

class StepComponent {
    static create(view, stepContext, componentContext) {
        const badges = Badges.createForStep(stepContext, view, componentContext);
        return new StepComponent(view, stepContext.step, stepContext.parentSequence, view.hasOutput, badges);
    }
    constructor(view, step, parentSequence, hasOutput, badges) {
        this.view = view;
        this.step = step;
        this.parentSequence = parentSequence;
        this.hasOutput = hasOutput;
        this.badges = badges;
    }
    findById(stepId) {
        if (this.step.id === stepId) {
            return this;
        }
        if (this.view.components) {
            for (const component of this.view.components) {
                const result = component.findById(stepId);
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }
    resolveClick(click) {
        if (this.view.components) {
            for (const component of this.view.components) {
                const result = component.resolveClick(click);
                if (result) {
                    return result;
                }
            }
        }
        if (this.view.placeholders) {
            for (const placeholder of this.view.placeholders) {
                const result = placeholder.resolveClick(click);
                if (result) {
                    return result;
                }
            }
        }
        const badgeResult = this.badges.resolveClick(click);
        if (badgeResult) {
            return badgeResult;
        }
        const viewResult = this.view.resolveClick(click);
        if (viewResult) {
            return viewResult === true
                ? {
                    type: ClickCommandType.selectStep,
                    component: this
                }
                : viewResult;
        }
        return null;
    }
    resolvePlaceholders(skipComponent, result) {
        if (skipComponent !== this) {
            if (this.view.components) {
                this.view.components.forEach(component => component.resolvePlaceholders(skipComponent, result));
            }
            if (this.view.placeholders) {
                this.view.placeholders.forEach(ph => result.placeholders.push(ph));
            }
            result.components.push(this);
        }
    }
    setIsDragging(isDragging) {
        this.view.setIsDragging(isDragging);
    }
    setIsSelected(isSelected) {
        this.view.setIsSelected(isSelected);
    }
    setIsDisabled(isDisabled) {
        this.view.setIsDisabled(isDisabled);
    }
    updateBadges(result) {
        if (this.view.components) {
            this.view.components.forEach(component => component.updateBadges(result));
        }
        this.badges.update(result);
    }
}

class StepExtensionResolver {
    static create(services) {
        const dict = {};
        for (let i = services.steps.length - 1; i >= 0; i--) {
            const extension = services.steps[i];
            dict[extension.componentType] = extension;
        }
        return new StepExtensionResolver(dict);
    }
    constructor(dict) {
        this.dict = dict;
    }
    resolve(componentType) {
        const extension = this.dict[componentType];
        if (!extension) {
            throw new Error(`Not supported component type: ${componentType}`);
        }
        return extension;
    }
}

class PlaceholderController {
    static create(state, configuration) {
        return new PlaceholderController(state, configuration);
    }
    constructor(state, configuration) {
        var _a, _b;
        this.configuration = configuration;
        const canCreate = (_a = this.configuration) === null || _a === void 0 ? void 0 : _a.canCreate;
        const canShow = (_b = this.configuration) === null || _b === void 0 ? void 0 : _b.canShow;
        this.canCreate = canCreate ? (sequence, index) => canCreate(sequence, index, state.definition) : () => true;
        this.canShow = canShow
            ? (sequence, index, draggingStepComponentType, draggingStepType) => canShow(sequence, index, draggingStepComponentType, draggingStepType, state.definition)
            : () => true;
    }
}

class RectPlaceholderView {
    static create(parent, width, height, radius, iconD, iconSize) {
        const g = Dom.svg('g', {
            visibility: 'hidden',
            class: 'sqd-placeholder'
        });
        parent.appendChild(g);
        const rect = Dom.svg('rect', {
            class: 'sqd-placeholder-rect',
            width,
            height,
            rx: radius,
            ry: radius
        });
        g.appendChild(rect);
        if (iconD) {
            const icon = Icons.appendPath(g, 'sqd-placeholder-icon-path', iconD, iconSize);
            Dom.translate(icon, (width - iconSize) / 2, (height - iconSize) / 2);
        }
        parent.appendChild(g);
        return new RectPlaceholderView(rect, g);
    }
    constructor(rect, g) {
        this.rect = rect;
        this.g = g;
    }
    setIsHover(isHover) {
        Dom.toggleClass(this.g, isHover, 'sqd-hover');
    }
    setIsVisible(isVisible) {
        Dom.attrs(this.g, {
            visibility: isVisible ? 'visible' : 'hidden'
        });
    }
}

class RectPlaceholder {
    static create(parent, size, parentSequence, index, radius, iconD, iconSize) {
        const view = RectPlaceholderView.create(parent, size.x, size.y, radius, iconD, iconSize);
        return new RectPlaceholder(view, parentSequence, index);
    }
    constructor(view, parentSequence, index) {
        this.view = view;
        this.parentSequence = parentSequence;
        this.index = index;
    }
    getClientRect() {
        return this.view.rect.getBoundingClientRect();
    }
    setIsHover(isHover) {
        this.view.setIsHover(isHover);
    }
    setIsVisible(isVisible) {
        this.view.setIsVisible(isVisible);
    }
    resolveClick() {
        return null;
    }
}

class DefaultRegionView {
    static create(parent, widths, height) {
        const totalWidth = widths.reduce((result, width) => result + width, 0);
        const lines = [
            drawLine(parent, 0, 0, totalWidth, 0),
            drawLine(parent, 0, 0, 0, height),
            drawLine(parent, 0, height, totalWidth, height),
            drawLine(parent, totalWidth, 0, totalWidth, height)
        ];
        let offsetX = widths[0];
        for (let i = 1; i < widths.length; i++) {
            lines.push(drawLine(parent, offsetX, 0, offsetX, height));
            offsetX += widths[i];
        }
        return new DefaultRegionView(lines, totalWidth, height);
    }
    constructor(lines, width, height) {
        this.lines = lines;
        this.width = width;
        this.height = height;
    }
    getClientPosition() {
        return getAbsolutePosition(this.lines[0]);
    }
    resolveClick(click) {
        const regionPosition = this.getClientPosition();
        const d = click.position.subtract(regionPosition);
        if (d.x >= 0 && d.y >= 0 && d.x < this.width * click.scale && d.y < this.height * click.scale) {
            return true;
        }
        return null;
    }
    setIsSelected(isSelected) {
        this.lines.forEach(region => {
            Dom.toggleClass(region, isSelected, 'sqd-selected');
        });
    }
}
function drawLine(parent, x1, y1, x2, y2) {
    const line = Dom.svg('line', {
        class: 'sqd-region',
        x1,
        y1,
        x2,
        y2
    });
    parent.insertBefore(line, parent.firstChild);
    return line;
}

class DefaultRegionComponentViewExtension {
    create(parentElement, componentClassName, stepContext, _, contentFactory) {
        const g = ComponentDom.stepG(componentClassName, stepContext.step.type, stepContext.step.id);
        parentElement.appendChild(g);
        return contentFactory(g, DefaultRegionView.create);
    }
}

class DefaultViewportControllerDesignerExtension {
    static create(configuration) {
        return new DefaultViewportControllerDesignerExtension(DefaultViewportControllerExtension.create(configuration));
    }
    constructor(viewportController) {
        this.viewportController = viewportController;
    }
}

class LineGrid {
    static create(size) {
        const path = Dom.svg('path', {
            class: 'sqd-line-grid-path',
            fill: 'none'
        });
        return new LineGrid(size, path);
    }
    constructor(size, element) {
        this.size = size;
        this.element = element;
    }
    setScale(_, scaledSize) {
        Dom.attrs(this.element, {
            d: `M ${scaledSize.x} 0 L 0 0 0 ${scaledSize.y}`
        });
    }
}

const defaultConfiguration$3 = {
    gridSizeX: 48,
    gridSizeY: 48
};
class LineGridExtension {
    static create(configuration) {
        return new LineGridExtension(configuration !== null && configuration !== void 0 ? configuration : defaultConfiguration$3);
    }
    constructor(configuration) {
        this.configuration = configuration;
    }
    create() {
        const size = new Vector(this.configuration.gridSizeX, this.configuration.gridSizeY);
        return LineGrid.create(size);
    }
}

class LineGridDesignerExtension {
    static create(configuration) {
        const grid = LineGridExtension.create(configuration);
        return new LineGridDesignerExtension(grid);
    }
    constructor(grid) {
        this.grid = grid;
    }
}

const defaultConfiguration$2 = {
    gapWidth: 88,
    gapHeight: 24,
    radius: 6,
    iconSize: 16
};
class RectPlaceholderExtension {
    static create(configuration) {
        return new RectPlaceholderExtension(configuration !== null && configuration !== void 0 ? configuration : defaultConfiguration$2);
    }
    constructor(configuration) {
        this.configuration = configuration;
        this.alongGapSize = new Vector(this.configuration.gapWidth, this.configuration.gapHeight);
        this.perpendicularGapSize = new Vector(this.configuration.gapHeight, this.configuration.gapWidth);
    }
    getGapSize(orientation) {
        return orientation === PlaceholderGapOrientation.perpendicular ? this.perpendicularGapSize : this.alongGapSize;
    }
    createForGap(parent, parentSequence, index, orientation) {
        const gapSize = this.getGapSize(orientation);
        return RectPlaceholder.create(parent, gapSize, parentSequence, index, this.configuration.radius, this.configuration.iconD, this.configuration.iconSize);
    }
    createForArea(parent, size, direction, parentSequence, index) {
        let iconD;
        if (direction === PlaceholderDirection.in) {
            iconD = Icons.folderIn;
        }
        else if (direction === PlaceholderDirection.out) {
            iconD = Icons.folderOut;
        }
        return RectPlaceholder.create(parent, size, parentSequence, index, this.configuration.radius, iconD, this.configuration.iconSize);
    }
}

class RectPlaceholderDesignerExtension {
    static create(configuration) {
        return new RectPlaceholderDesignerExtension(RectPlaceholderExtension.create(configuration));
    }
    constructor(placeholder) {
        this.placeholder = placeholder;
    }
}

class StartStopRootComponentDesignerExtension {
    static create(configuration) {
        return new StartStopRootComponentDesignerExtension(StartStopRootComponentExtension.create(configuration));
    }
    constructor(rootComponent) {
        this.rootComponent = rootComponent;
    }
}

const defaultConfiguration$1 = {
    view: {
        paddingTop: 20,
        paddingX: 20,
        inputSize: 18,
        inputRadius: 4,
        inputIconSize: 14,
        autoHideInputOnDrag: true,
        isRegionClickable: true,
        label: {
            height: 22,
            paddingX: 10,
            minWidth: 50,
            radius: 10
        }
    }
};
class ContainerStepExtension {
    static create(configuration) {
        return new ContainerStepExtension(configuration !== null && configuration !== void 0 ? configuration : defaultConfiguration$1);
    }
    constructor(configuration) {
        this.configuration = configuration;
        this.componentType = 'container';
        this.createComponentView = createContainerStepComponentViewFactory(this.configuration.view);
    }
}

const defaultViewConfiguration$1 = {
    minBranchWidth: 88,
    paddingX: 20,
    paddingTop1: 0,
    paddingTop2: 22,
    connectionHeight: 20,
    noBranchPaddingBottom: 24,
    inputSize: 18,
    inputIconSize: 14,
    inputRadius: 4,
    autoHideInputOnDrag: true,
    isRegionClickable: true,
    branchNameLabel: {
        height: 22,
        paddingX: 10,
        minWidth: 50,
        radius: 10
    },
    nameLabel: {
        height: 22,
        paddingX: 10,
        minWidth: 50,
        radius: 10
    }
};
class SwitchStepExtension {
    static create(configuration) {
        return new SwitchStepExtension(configuration);
    }
    constructor(configuration) {
        var _a, _b, _c;
        this.configuration = configuration;
        this.componentType = 'switch';
        this.createComponentView = createSwitchStepComponentViewFactory((_b = (_a = this.configuration) === null || _a === void 0 ? void 0 : _a.view) !== null && _b !== void 0 ? _b : defaultViewConfiguration$1, (_c = this.configuration) === null || _c === void 0 ? void 0 : _c.branchNamesResolver);
    }
}

const defaultConfiguration = {
    view: {
        paddingLeft: 12,
        paddingRight: 12,
        paddingY: 10,
        textMarginLeft: 12,
        minTextWidth: 70,
        iconSize: 22,
        radius: 5,
        inputSize: 14,
        outputSize: 10
    }
};
class TaskStepExtension {
    static create(configuration) {
        return new TaskStepExtension(configuration !== null && configuration !== void 0 ? configuration : defaultConfiguration);
    }
    constructor(configuration) {
        this.configuration = configuration;
        this.componentType = 'task';
        this.createComponentView = createTaskStepComponentViewFactory(false, this.configuration.view);
    }
}

const defaultViewConfiguration = {
    isRegionEnabled: true,
    paddingY: 10,
    connectionHeight: 20,
    emptyPaddingX: 20,
    emptyPaddingY: 20,
    emptyInputSize: 14,
    emptyOutputSize: 10,
    emptyIconSize: 24
};
class LaunchPadStepExtension {
    static create(configuration) {
        return new LaunchPadStepExtension(configuration);
    }
    constructor(configuration) {
        var _a, _b;
        this.configuration = configuration;
        this.componentType = 'launchPad';
        this.createComponentView = createLaunchPadStepComponentViewFactory(false, (_b = (_a = this.configuration) === null || _a === void 0 ? void 0 : _a.view) !== null && _b !== void 0 ? _b : defaultViewConfiguration);
    }
}

class StepsDesignerExtension {
    static create(configuration) {
        const steps = [];
        if (configuration.container) {
            steps.push(ContainerStepExtension.create(configuration.container));
        }
        if (configuration.switch) {
            steps.push(SwitchStepExtension.create(configuration.switch));
        }
        if (configuration.task) {
            steps.push(TaskStepExtension.create(configuration.task));
        }
        if (configuration.launchPad) {
            steps.push(LaunchPadStepExtension.create(configuration.launchPad));
        }
        return new StepsDesignerExtension(steps);
    }
    constructor(steps) {
        this.steps = steps;
    }
}

class DefinitionValidator {
    constructor(configuration, state) {
        this.configuration = configuration;
        this.state = state;
    }
    validateStep(step, parentSequence) {
        var _a;
        if ((_a = this.configuration) === null || _a === void 0 ? void 0 : _a.step) {
            return this.configuration.step(step, parentSequence, this.state.definition);
        }
        return true;
    }
    validateRoot() {
        var _a;
        if ((_a = this.configuration) === null || _a === void 0 ? void 0 : _a.root) {
            return this.configuration.root(this.state.definition);
        }
        return true;
    }
}

class IconProvider {
    constructor(configuration) {
        this.configuration = configuration;
    }
    getIconUrl(step) {
        if (this.configuration.iconUrlProvider) {
            return this.configuration.iconUrlProvider(step.componentType, step.type);
        }
        return null;
    }
}

class StepComponentViewContextFactory {
    static create(stepContext, componentContext) {
        const preferenceKeyPrefix = stepContext.step.id + ':';
        return {
            i18n: componentContext.i18n,
            getStepIconUrl: () => componentContext.iconProvider.getIconUrl(stepContext.step),
            getStepName: () => componentContext.i18n(`step.${stepContext.step.type}.name`, stepContext.step.name),
            createStepComponent: (parentElement, parentSequence, step, position) => {
                return componentContext.stepComponentFactory.create(parentElement, {
                    parentSequence,
                    step,
                    depth: stepContext.depth + 1,
                    position,
                    isInputConnected: stepContext.isInputConnected,
                    isOutputConnected: stepContext.isOutputConnected,
                    isPreview: stepContext.isPreview
                }, componentContext);
            },
            createSequenceComponent: (parentElement, sequence) => {
                const sequenceContext = {
                    sequence,
                    depth: stepContext.depth + 1,
                    isInputConnected: true,
                    isOutputConnected: stepContext.isOutputConnected,
                    isPreview: stepContext.isPreview
                };
                return componentContext.services.sequenceComponent.create(parentElement, sequenceContext, componentContext);
            },
            createRegionComponentView(parentElement, componentClassName, contentFactory) {
                return componentContext.services.regionComponentView.create(parentElement, componentClassName, stepContext, this, contentFactory);
            },
            getPlaceholderGapSize: orientation => componentContext.services.placeholder.getGapSize(orientation),
            createPlaceholderForGap: componentContext.services.placeholder.createForGap.bind(componentContext.services.placeholder),
            createPlaceholderForArea: componentContext.services.placeholder.createForArea.bind(componentContext.services.placeholder),
            getPreference: (key) => componentContext.preferenceStorage.getItem(preferenceKeyPrefix + key),
            setPreference: (key, value) => componentContext.preferenceStorage.setItem(preferenceKeyPrefix + key, value)
        };
    }
}

class StepComponentFactory {
    constructor(stepExtensionResolver) {
        this.stepExtensionResolver = stepExtensionResolver;
    }
    create(parentElement, stepContext, componentContext) {
        const viewContext = StepComponentViewContextFactory.create(stepContext, componentContext);
        const extension = this.stepExtensionResolver.resolve(stepContext.step.componentType);
        const view = extension.createComponentView(parentElement, stepContext, viewContext);
        const wrappedView = componentContext.services.stepComponentViewWrapper.wrap(view, stepContext);
        return StepComponent.create(wrappedView, stepContext, componentContext);
    }
}

class ComponentContext {
    static create(configuration, state, stepExtensionResolver, placeholderController, definitionWalker, preferenceStorage, i18n, services) {
        const validator = new DefinitionValidator(configuration.validator, state);
        const iconProvider = new IconProvider(configuration.steps);
        const stepComponentFactory = new StepComponentFactory(stepExtensionResolver);
        return new ComponentContext(configuration.shadowRoot, validator, iconProvider, placeholderController, stepComponentFactory, definitionWalker, services, preferenceStorage, i18n);
    }
    constructor(shadowRoot, validator, iconProvider, placeholderController, stepComponentFactory, definitionWalker, services, preferenceStorage, i18n) {
        this.shadowRoot = shadowRoot;
        this.validator = validator;
        this.iconProvider = iconProvider;
        this.placeholderController = placeholderController;
        this.stepComponentFactory = stepComponentFactory;
        this.definitionWalker = definitionWalker;
        this.services = services;
        this.preferenceStorage = preferenceStorage;
        this.i18n = i18n;
    }
}

class CustomActionController {
    constructor(configuration, state, stateModifier) {
        this.configuration = configuration;
        this.state = state;
        this.stateModifier = stateModifier;
    }
    trigger(action, step, sequence) {
        const handler = this.configuration.customActionHandler;
        if (!handler) {
            console.warn(`Custom action handler is not defined (action type: ${action.type})`);
            return;
        }
        const context = this.createCustomActionHandlerContext();
        handler(action, step, sequence, context);
    }
    createCustomActionHandlerContext() {
        return {
            notifyStepNameChanged: (stepId) => this.notifyStepChanged(DefinitionChangeType.stepNameChanged, stepId, false),
            notifyStepPropertiesChanged: (stepId) => this.notifyStepChanged(DefinitionChangeType.stepPropertyChanged, stepId, false),
            notifyStepInserted: (stepId) => this.notifyStepChanged(DefinitionChangeType.stepInserted, stepId, true),
            notifyStepMoved: (stepId) => this.notifyStepChanged(DefinitionChangeType.stepMoved, stepId, true),
            notifyStepDeleted: (stepId) => this.notifyStepChanged(DefinitionChangeType.stepDeleted, stepId, true)
        };
    }
    notifyStepChanged(changeType, stepId, updateDependencies) {
        if (!stepId) {
            throw new Error('Step id is empty');
        }
        this.state.notifyDefinitionChanged(changeType, stepId);
        if (updateDependencies) {
            this.stateModifier.updateDependencies();
        }
    }
}

class EditorView {
    static create(parent) {
        return new EditorView(parent);
    }
    constructor(parent) {
        this.parent = parent;
        this.currentContainer = null;
    }
    setContent(content, className) {
        const container = Dom.element('div', {
            class: className
        });
        container.appendChild(content);
        if (this.currentContainer) {
            this.parent.removeChild(this.currentContainer);
        }
        this.parent.appendChild(container);
        this.currentContainer = container;
    }
    destroy() {
        if (this.currentContainer) {
            this.parent.removeChild(this.currentContainer);
        }
    }
}

class Editor {
    static create(parent, api, stepEditorClassName, stepEditorProvider, rootEditorClassName, rootEditorProvider, customSelectedStepIdProvider) {
        const view = EditorView.create(parent);
        function render(step) {
            const definition = api.getDefinition();
            let content;
            let className;
            if (step) {
                const stepContext = api.createStepEditorContext(step.id);
                content = stepEditorProvider(step, stepContext, definition, api.isReadonly());
                className = stepEditorClassName;
            }
            else {
                const rootContext = api.createRootEditorContext();
                content = rootEditorProvider(definition, rootContext, api.isReadonly());
                className = rootEditorClassName;
            }
            view.setContent(content, className);
        }
        const renderer = api.runRenderer(step => render(step), customSelectedStepIdProvider);
        return new Editor(view, renderer);
    }
    constructor(view, renderer) {
        this.view = view;
        this.renderer = renderer;
    }
    destroy() {
        this.view.destroy();
        this.renderer.destroy();
    }
}

function readMousePosition(e) {
    return new Vector(e.pageX, e.pageY);
}
function readTouchClientPosition(e) {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        return new Vector(touch.clientX, touch.clientY);
    }
    throw new Error('Unknown touch position');
}
function readTouchPosition(e) {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        return new Vector(touch.pageX, touch.pageY);
    }
    throw new Error('Unknown touch position');
}
function calculateFingerDistance(e) {
    if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    }
    throw new Error('Cannot calculate finger distance');
}
function readFingerCenterPoint(e) {
    if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        return new Vector((t0.pageX + t1.pageX) / 2, (t0.pageY + t1.pageY) / 2);
    }
    throw new Error('Cannot calculate finger center point');
}

const notInitializedError$1 = 'State is not initialized';
const nonPassiveOptions$1 = {
    passive: false
};
class BehaviorController {
    static create(shadowRoot) {
        return new BehaviorController(shadowRoot !== null && shadowRoot !== void 0 ? shadowRoot : document, shadowRoot);
    }
    constructor(dom, shadowRoot) {
        this.dom = dom;
        this.shadowRoot = shadowRoot;
        this.previousEndToken = null;
        this.state = null;
        this.onMouseMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.move(readMousePosition(e));
        };
        this.onTouchMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.move(readTouchPosition(e));
        };
        this.onMouseUp = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.stop(false, e.target);
        };
        this.onTouchEnd = (e) => {
            var _a;
            e.preventDefault();
            e.stopPropagation();
            if (!this.state) {
                throw new Error(notInitializedError$1);
            }
            const position = (_a = this.state.lastPosition) !== null && _a !== void 0 ? _a : this.state.startPosition;
            const clientPosition = position.subtract(new Vector(window.scrollX, window.scrollY));
            const element = this.dom.elementFromPoint(clientPosition.x, clientPosition.y);
            this.stop(false, element);
        };
        this.onTouchStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.touches.length !== 1) {
                this.stop(true, null);
            }
        };
    }
    start(startPosition, behavior) {
        if (this.state) {
            this.stop(true, null);
            return;
        }
        this.state = {
            startPosition,
            behavior
        };
        behavior.onStart(this.state.startPosition);
        if (this.shadowRoot) {
            this.bind(this.shadowRoot);
        }
        this.bind(window);
    }
    bind(target) {
        target.addEventListener('mousemove', this.onMouseMove, false);
        target.addEventListener('touchmove', this.onTouchMove, nonPassiveOptions$1);
        target.addEventListener('mouseup', this.onMouseUp, false);
        target.addEventListener('touchend', this.onTouchEnd, nonPassiveOptions$1);
        target.addEventListener('touchstart', this.onTouchStart, nonPassiveOptions$1);
    }
    unbind(target) {
        target.removeEventListener('mousemove', this.onMouseMove, false);
        target.removeEventListener('touchmove', this.onTouchMove, nonPassiveOptions$1);
        target.removeEventListener('mouseup', this.onMouseUp, false);
        target.removeEventListener('touchend', this.onTouchEnd, nonPassiveOptions$1);
        target.removeEventListener('touchstart', this.onTouchStart, nonPassiveOptions$1);
    }
    move(position) {
        if (!this.state) {
            throw new Error(notInitializedError$1);
        }
        this.state.lastPosition = position;
        const delta = this.state.startPosition.subtract(position);
        const newBehavior = this.state.behavior.onMove(delta);
        if (newBehavior) {
            this.state.behavior.onEnd(true, null, null);
            this.state.behavior = newBehavior;
            this.state.startPosition = position;
            this.state.behavior.onStart(this.state.startPosition);
        }
    }
    stop(interrupt, element) {
        if (!this.state) {
            throw new Error(notInitializedError$1);
        }
        if (this.shadowRoot) {
            this.unbind(this.shadowRoot);
        }
        this.unbind(window);
        const endToken = this.state.behavior.onEnd(interrupt, element, this.previousEndToken);
        this.state = null;
        this.previousEndToken = endToken || null;
    }
}

class SequenceModifier {
    static tryMoveStep(sourceSequence, step, targetSequence, targetIndex) {
        const sourceIndex = sourceSequence.indexOf(step);
        if (sourceIndex < 0) {
            throw new Error('Step not found in source sequence');
        }
        const isSameSequence = sourceSequence === targetSequence;
        if (isSameSequence) {
            if (sourceIndex < targetIndex) {
                targetIndex--;
            }
            if (sourceIndex === targetIndex) {
                return null; // No changes
            }
        }
        return function apply() {
            sourceSequence.splice(sourceIndex, 1);
            targetSequence.splice(targetIndex, 0, step);
        };
    }
    static insertStep(step, targetSequence, targetIndex) {
        targetSequence.splice(targetIndex, 0, step);
    }
    static deleteStep(step, parentSequence) {
        const index = parentSequence.indexOf(step);
        if (index < 0) {
            throw new Error('Unknown step');
        }
        parentSequence.splice(index, 1);
    }
}

class StepDuplicator {
    constructor(uidGenerator, definitionWalker) {
        this.uidGenerator = uidGenerator;
        this.definitionWalker = definitionWalker;
    }
    duplicate(step) {
        const newStep = ObjectCloner.deepClone(step);
        newStep.id = this.uidGenerator();
        this.definitionWalker.forEachChildren(newStep, s => {
            s.id = this.uidGenerator();
        });
        return newStep;
    }
}

class FolderPathDefinitionModifierDependency {
    constructor(state, definitionWalker) {
        this.state = state;
        this.definitionWalker = definitionWalker;
    }
    update() {
        for (let index = 0; index < this.state.folderPath.length; index++) {
            const stepId = this.state.folderPath[index];
            const found = this.definitionWalker.findById(this.state.definition, stepId);
            if (!found) {
                // We need to update path if any folder is deleted.
                const newPath = this.state.folderPath.slice(0, index);
                this.state.setFolderPath(newPath);
                break;
            }
        }
    }
}

class SelectedStepIdDefinitionModifierDependency {
    constructor(state, definitionWalker) {
        this.state = state;
        this.definitionWalker = definitionWalker;
    }
    update() {
        if (this.state.selectedStepId) {
            const found = this.definitionWalker.findById(this.state.definition, this.state.selectedStepId);
            if (!found) {
                // We need to unselect step when it's deleted.
                this.state.setSelectedStepId(null);
            }
        }
    }
}

class StateModifier {
    static create(definitionWalker, uidGenerator, state, configuration) {
        const dependencies = [];
        dependencies.push(new SelectedStepIdDefinitionModifierDependency(state, definitionWalker));
        dependencies.push(new FolderPathDefinitionModifierDependency(state, definitionWalker));
        return new StateModifier(definitionWalker, uidGenerator, state, configuration, dependencies);
    }
    constructor(definitionWalker, uidGenerator, state, configuration, dependencies) {
        this.definitionWalker = definitionWalker;
        this.uidGenerator = uidGenerator;
        this.state = state;
        this.configuration = configuration;
        this.dependencies = dependencies;
    }
    addDependency(dependency) {
        this.dependencies.push(dependency);
    }
    isSelectable(step, parentSequence) {
        return this.configuration.isSelectable ? this.configuration.isSelectable(step, parentSequence) : true;
    }
    isSelectableById(stepId) {
        if (this.configuration.isSelectable) {
            const result = this.definitionWalker.getParentSequence(this.state.definition, stepId);
            return this.configuration.isSelectable(result.step, result.parentSequence);
        }
        return true;
    }
    canUnselectSelectedStep() {
        if (this.state.selectedStepId) {
            if (this.configuration.canUnselectStep) {
                const result = this.definitionWalker.getParentSequence(this.state.definition, this.state.selectedStepId);
                return this.configuration.canUnselectStep(result.step, result.parentSequence);
            }
            return true;
        }
        return null;
    }
    /**
     * @description Check the `isSelectable` callback before calling this method.
     */
    trySelectStepById(stepIdOrNull) {
        const can = this.canUnselectSelectedStep();
        if (can === true || can === null) {
            this.state.setSelectedStepId(stepIdOrNull);
            return true;
        }
        this.state.notifyStepUnselectionBlocked(stepIdOrNull);
        return false;
    }
    tryResetSelectedStep() {
        let stepIdOrNull = this.state.tryGetLastStepIdFromFolderPath();
        if (stepIdOrNull && !this.isSelectableById(stepIdOrNull)) {
            stepIdOrNull = null;
        }
        this.trySelectStepById(stepIdOrNull);
    }
    isDeletable(step, parentSequence) {
        return this.configuration.isDeletable ? this.configuration.isDeletable(step, parentSequence) : true;
    }
    isDeletableById(stepId) {
        if (this.configuration.isDeletable) {
            const result = this.definitionWalker.getParentSequence(this.state.definition, stepId);
            return this.configuration.isDeletable(result.step, result.parentSequence);
        }
        return true;
    }
    /**
     * @description Check the `isDeletable` callback before calling this method.
     */
    tryDeleteById(stepId) {
        const result = this.definitionWalker.getParentSequence(this.state.definition, stepId);
        const canDeleteStep = this.configuration.canDeleteStep
            ? this.configuration.canDeleteStep(result.step, result.parentSequence)
            : true;
        if (!canDeleteStep) {
            return false;
        }
        SequenceModifier.deleteStep(result.step, result.parentSequence);
        this.state.notifyDefinitionChanged(DefinitionChangeType.stepDeleted, result.step.id);
        this.updateDependencies();
        return true;
    }
    tryInsert(step, targetSequence, targetIndex) {
        const canInsertStep = this.configuration.canInsertStep ? this.configuration.canInsertStep(step, targetSequence, targetIndex) : true;
        if (!canInsertStep) {
            return false;
        }
        SequenceModifier.insertStep(step, targetSequence, targetIndex);
        this.state.notifyDefinitionChanged(DefinitionChangeType.stepInserted, step.id);
        if (!this.configuration.isAutoSelectDisabled && this.isSelectable(step, targetSequence)) {
            this.trySelectStepById(step.id);
        }
        return true;
    }
    isDraggable(step, parentSequence) {
        return this.configuration.isDraggable ? this.configuration.isDraggable(step, parentSequence) : true;
    }
    tryMove(sourceSequence, step, targetSequence, targetIndex) {
        const apply = SequenceModifier.tryMoveStep(sourceSequence, step, targetSequence, targetIndex);
        if (!apply) {
            return false;
        }
        const canMoveStep = this.configuration.canMoveStep
            ? this.configuration.canMoveStep(sourceSequence, step, targetSequence, targetIndex)
            : true;
        if (!canMoveStep) {
            return false;
        }
        apply();
        this.state.notifyDefinitionChanged(DefinitionChangeType.stepMoved, step.id);
        if (!this.configuration.isAutoSelectDisabled && this.isSelectable(step, targetSequence)) {
            this.trySelectStepById(step.id);
        }
        return true;
    }
    isDuplicable(step, parentSequence) {
        return this.configuration.isDuplicable ? this.configuration.isDuplicable(step, parentSequence) : false;
    }
    /**
     * @description Check the `isDuplicable` callback before calling this method.
     */
    tryDuplicate(step, parentSequence) {
        const duplicator = new StepDuplicator(this.uidGenerator, this.definitionWalker);
        const index = parentSequence.indexOf(step);
        const newStep = duplicator.duplicate(step);
        return this.tryInsert(newStep, parentSequence, index + 1);
    }
    replaceDefinition(definition) {
        if (!definition) {
            throw new Error('Definition is empty');
        }
        this.state.setDefinition(definition);
        this.updateDependencies();
    }
    updateDependencies() {
        this.dependencies.forEach(dependency => dependency.update());
    }
}

class DesignerState {
    constructor(definition, isReadonly, isToolboxCollapsed, isEditorCollapsed) {
        this.definition = definition;
        this.isReadonly = isReadonly;
        this.isToolboxCollapsed = isToolboxCollapsed;
        this.isEditorCollapsed = isEditorCollapsed;
        this.onViewportChanged = new SimpleEvent();
        this.onSelectedStepIdChanged = new SimpleEvent();
        this.onStepUnselectionBlocked = new SimpleEvent();
        this.onFolderPathChanged = new SimpleEvent();
        this.onIsReadonlyChanged = new SimpleEvent();
        this.onIsDraggingChanged = new SimpleEvent();
        this.onIsDragDisabledChanged = new SimpleEvent();
        this.onDefinitionChanged = new SimpleEvent();
        this.onIsToolboxCollapsedChanged = new SimpleEvent();
        this.onIsEditorCollapsedChanged = new SimpleEvent();
        this.viewport = {
            position: new Vector(0, 0),
            scale: 1
        };
        this.selectedStepId = null;
        this.folderPath = [];
        this.isDragging = false;
        this.isDragDisabled = false;
    }
    setSelectedStepId(stepId) {
        if (this.selectedStepId !== stepId) {
            this.selectedStepId = stepId;
            this.onSelectedStepIdChanged.forward(stepId);
        }
    }
    pushStepIdToFolderPath(stepId) {
        this.folderPath.push(stepId);
        this.onFolderPathChanged.forward(this.folderPath);
    }
    setFolderPath(path) {
        this.folderPath = path;
        this.onFolderPathChanged.forward(path);
    }
    tryGetLastStepIdFromFolderPath() {
        return this.folderPath.length > 0 ? this.folderPath[this.folderPath.length - 1] : null;
    }
    setDefinition(definition) {
        this.definition = definition;
        this.notifyDefinitionChanged(DefinitionChangeType.rootReplaced, null);
    }
    notifyDefinitionChanged(changeType, stepId) {
        this.onDefinitionChanged.forward({ changeType, stepId });
    }
    notifyStepUnselectionBlocked(stepId) {
        this.onStepUnselectionBlocked.forward(stepId);
    }
    setViewport(viewport) {
        this.viewport = viewport;
        this.onViewportChanged.forward(viewport);
    }
    setIsReadonly(isReadonly) {
        if (this.isReadonly !== isReadonly) {
            this.isReadonly = isReadonly;
            this.onIsReadonlyChanged.forward(isReadonly);
        }
    }
    setIsDragging(isDragging) {
        if (this.isDragging !== isDragging) {
            this.isDragging = isDragging;
            this.onIsDraggingChanged.forward(isDragging);
        }
    }
    setIsDragDisabled(isDragDisabled) {
        if (this.isDragDisabled !== isDragDisabled) {
            this.isDragDisabled = isDragDisabled;
            this.onIsDragDisabledChanged.forward(isDragDisabled);
        }
    }
    setIsToolboxCollapsed(isCollapsed) {
        if (this.isToolboxCollapsed !== isCollapsed) {
            this.isToolboxCollapsed = isCollapsed;
            this.onIsToolboxCollapsedChanged.forward(isCollapsed);
        }
    }
    setIsEditorCollapsed(isCollapsed) {
        if (this.isEditorCollapsed !== isCollapsed) {
            this.isEditorCollapsed = isCollapsed;
            this.onIsEditorCollapsedChanged.forward(isCollapsed);
        }
    }
}

class HistoryController {
    static create(initialStack, state, stateModifier, configuration) {
        if (!configuration.undoStackSize || configuration.undoStackSize < 1) {
            throw new Error('Invalid undo stack size');
        }
        const stack = initialStack || {
            index: 0,
            items: []
        };
        const controller = new HistoryController(stack, state, stateModifier, configuration.undoStackSize);
        if (!initialStack) {
            controller.rememberCurrent(DefinitionChangeType.rootReplaced, null);
        }
        state.onDefinitionChanged.subscribe(event => {
            if (event.changeType !== DefinitionChangeType.rootReplaced) {
                controller.rememberCurrent(event.changeType, event.stepId);
            }
        });
        return controller;
    }
    constructor(stack, state, stateModifier, stackSize) {
        this.stack = stack;
        this.state = state;
        this.stateModifier = stateModifier;
        this.stackSize = stackSize;
    }
    canUndo() {
        return this.stack.index > 1;
    }
    undo() {
        this.stack.index--;
        this.commit();
    }
    canRedo() {
        return this.stack.index < this.stack.items.length;
    }
    redo() {
        this.stack.index++;
        this.commit();
    }
    dump() {
        return Object.assign({}, this.stack);
    }
    replaceDefinition(definition) {
        if (definition == this.state.definition) {
            throw new Error('Cannot use the same instance of definition');
        }
        this.remember(definition, DefinitionChangeType.rootReplaced, null);
        this.commit();
    }
    rememberCurrent(changeType, stepId) {
        this.remember(this.state.definition, changeType, stepId);
    }
    remember(sourceDefinition, changeType, stepId) {
        const definition = ObjectCloner.deepClone(sourceDefinition);
        if (this.stack.items.length > 0 && this.stack.index === this.stack.items.length) {
            const lastItem = this.stack.items[this.stack.items.length - 1];
            if (areItemsEqual(lastItem, changeType, stepId)) {
                lastItem.definition = definition;
                return;
            }
        }
        this.stack.items.splice(this.stack.index);
        this.stack.items.push({
            definition,
            changeType,
            stepId
        });
        if (this.stack.items.length > this.stackSize) {
            this.stack.items.splice(0, this.stack.items.length - this.stackSize - 1);
        }
        this.stack.index = this.stack.items.length;
    }
    commit() {
        const definition = ObjectCloner.deepClone(this.stack.items[this.stack.index - 1].definition);
        this.stateModifier.replaceDefinition(definition);
    }
}
function areItemsEqual(item, changeType, stepId) {
    return changeType !== DefinitionChangeType.rootReplaced && item.changeType === changeType && item.stepId === stepId;
}

class LayoutController {
    constructor(placeholder) {
        this.placeholder = placeholder;
    }
    isMobile() {
        return this.placeholder.clientWidth < 400; // TODO
    }
}

class WorkspaceControllerWrapper {
    set(controller) {
        if (this.controller) {
            throw new Error('Controller is already set');
        }
        this.controller = controller;
    }
    get() {
        if (!this.controller) {
            throw new Error('Controller is not set');
        }
        return this.controller;
    }
    resolvePlaceholders(skipComponent) {
        return this.get().resolvePlaceholders(skipComponent);
    }
    getComponentByStepId(stepId) {
        return this.get().getComponentByStepId(stepId);
    }
    getCanvasPosition() {
        return this.get().getCanvasPosition();
    }
    getCanvasSize() {
        return this.get().getCanvasSize();
    }
    getRootComponentSize() {
        return this.get().getRootComponentSize();
    }
    updateBadges() {
        this.get().updateBadges();
    }
    updateRootComponent() {
        this.get().updateRootComponent();
    }
    updateCanvasSize() {
        this.get().updateCanvasSize();
    }
}

class MemoryPreferenceStorage {
    constructor() {
        this.map = {};
    }
    setItem(key, value) {
        this.map[key] = value;
    }
    getItem(key) {
        var _a;
        return (_a = this.map[key]) !== null && _a !== void 0 ? _a : null;
    }
}

class DesignerContext {
    static create(placeholder, startDefinition, configuration, services) {
        var _a, _b, _c, _d, _e, _f;
        const definition = ObjectCloner.deepClone(startDefinition);
        const layoutController = new LayoutController(placeholder);
        const isReadonly = Boolean(configuration.isReadonly);
        const isToolboxCollapsed = configuration.toolbox ? (_a = configuration.toolbox.isCollapsed) !== null && _a !== void 0 ? _a : layoutController.isMobile() : false;
        const isEditorCollapsed = configuration.editors ? (_b = configuration.editors.isCollapsed) !== null && _b !== void 0 ? _b : layoutController.isMobile() : false;
        const theme = configuration.theme || 'light';
        const state = new DesignerState(definition, isReadonly, isToolboxCollapsed, isEditorCollapsed);
        const workspaceController = new WorkspaceControllerWrapper();
        const behaviorController = BehaviorController.create(configuration.shadowRoot);
        const stepExtensionResolver = StepExtensionResolver.create(services);
        const placeholderController = PlaceholderController.create(state, configuration.placeholder);
        const definitionWalker = (_c = configuration.definitionWalker) !== null && _c !== void 0 ? _c : new sequential_workflow_model__WEBPACK_IMPORTED_MODULE_0__.DefinitionWalker();
        const i18n = (_d = configuration.i18n) !== null && _d !== void 0 ? _d : ((_, defaultValue) => defaultValue);
        const uidGenerator = (_e = configuration.uidGenerator) !== null && _e !== void 0 ? _e : Uid.next;
        const stateModifier = StateModifier.create(definitionWalker, uidGenerator, state, configuration.steps);
        const customActionController = new CustomActionController(configuration, state, stateModifier);
        let historyController = undefined;
        if (configuration.undoStackSize) {
            historyController = HistoryController.create(configuration.undoStack, state, stateModifier, configuration);
        }
        const preferenceStorage = (_f = configuration.preferenceStorage) !== null && _f !== void 0 ? _f : new MemoryPreferenceStorage();
        const componentContext = ComponentContext.create(configuration, state, stepExtensionResolver, placeholderController, definitionWalker, preferenceStorage, i18n, services);
        return new DesignerContext(theme, state, configuration, services, componentContext, definitionWalker, i18n, uidGenerator, stateModifier, layoutController, workspaceController, placeholderController, behaviorController, customActionController, historyController);
    }
    constructor(theme, state, configuration, services, componentContext, definitionWalker, i18n, uidGenerator, stateModifier, layoutController, workspaceController, placeholderController, behaviorController, customActionController, historyController) {
        this.theme = theme;
        this.state = state;
        this.configuration = configuration;
        this.services = services;
        this.componentContext = componentContext;
        this.definitionWalker = definitionWalker;
        this.i18n = i18n;
        this.uidGenerator = uidGenerator;
        this.stateModifier = stateModifier;
        this.layoutController = layoutController;
        this.workspaceController = workspaceController;
        this.placeholderController = placeholderController;
        this.behaviorController = behaviorController;
        this.customActionController = customActionController;
        this.historyController = historyController;
    }
    setWorkspaceController(controller) {
        this.workspaceController.set(controller);
    }
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function isElementAttached(dom, element) {
    return !(dom.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_DISCONNECTED);
}

let lastGridPatternId = 0;
const listenerOptions$1 = {
    passive: false
};
class WorkspaceView {
    static create(parent, componentContext) {
        const patternId = 'sqd-grid-pattern-' + lastGridPatternId++;
        const pattern = Dom.svg('pattern', {
            id: patternId,
            patternUnits: 'userSpaceOnUse'
        });
        const gridPattern = componentContext.services.grid.create();
        const defs = Dom.svg('defs');
        pattern.appendChild(gridPattern.element);
        defs.appendChild(pattern);
        const foreground = Dom.svg('g');
        const workspace = Dom.element('div', {
            class: 'sqd-workspace'
        });
        const canvas = Dom.svg('svg', {
            class: 'sqd-workspace-canvas'
        });
        canvas.appendChild(defs);
        canvas.appendChild(Dom.svg('rect', {
            width: '100%',
            height: '100%',
            fill: `url(#${patternId})`
        }));
        canvas.appendChild(foreground);
        workspace.appendChild(canvas);
        parent.appendChild(workspace);
        const view = new WorkspaceView(componentContext.shadowRoot, workspace, canvas, pattern, gridPattern, foreground, componentContext);
        window.addEventListener('resize', view.onResize, false);
        return view;
    }
    constructor(shadowRoot, workspace, canvas, pattern, gridPattern, foreground, context) {
        this.shadowRoot = shadowRoot;
        this.workspace = workspace;
        this.canvas = canvas;
        this.pattern = pattern;
        this.gridPattern = gridPattern;
        this.foreground = foreground;
        this.context = context;
        this.onResize = () => {
            this.refreshSize();
        };
    }
    render(sequence, parentPlaceIndicator) {
        if (this.rootComponent) {
            this.foreground.removeChild(this.rootComponent.view.g);
        }
        this.rootComponent = this.context.services.rootComponent.create(this.foreground, sequence, parentPlaceIndicator, this.context);
        this.refreshSize();
    }
    setPositionAndScale(position, scale) {
        const scaledSize = this.gridPattern.size.multiplyByScalar(scale);
        Dom.attrs(this.pattern, {
            x: position.x,
            y: position.y,
            width: scaledSize.x,
            height: scaledSize.y
        });
        this.gridPattern.setScale(scale, scaledSize);
        Dom.attrs(this.foreground, {
            transform: `translate(${position.x}, ${position.y}) scale(${scale})`
        });
    }
    getCanvasPosition() {
        return getAbsolutePosition(this.canvas);
    }
    getCanvasSize() {
        return new Vector(this.canvas.clientWidth, this.canvas.clientHeight);
    }
    bindMouseDown(handler) {
        this.canvas.addEventListener('mousedown', e => {
            e.preventDefault();
            handler(readMousePosition(e), e.target, e.button, e.altKey);
        }, false);
    }
    bindTouchStart(clickHandler, pinchToZoomHandler) {
        this.canvas.addEventListener('touchstart', e => {
            var _a;
            e.preventDefault();
            if (e.touches.length === 2) {
                pinchToZoomHandler(calculateFingerDistance(e), readFingerCenterPoint(e));
                return;
            }
            const clientPosition = readTouchClientPosition(e);
            const dom = (_a = this.shadowRoot) !== null && _a !== void 0 ? _a : document;
            const element = dom.elementFromPoint(clientPosition.x, clientPosition.y);
            if (element) {
                const position = readTouchPosition(e);
                clickHandler(position, element, 0, false);
            }
        }, listenerOptions$1);
    }
    bindContextMenu(handler) {
        this.canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            handler(readMousePosition(e), e.target);
        }, false);
    }
    bindWheel(handler) {
        this.canvas.addEventListener('wheel', handler, listenerOptions$1);
    }
    destroy() {
        window.removeEventListener('resize', this.onResize, false);
    }
    refreshSize() {
        Dom.attrs(this.canvas, {
            width: this.workspace.offsetWidth,
            height: this.workspace.offsetHeight
        });
    }
}

class MoveViewportBehavior {
    static create(resetSelectedStep, context) {
        return new MoveViewportBehavior(context.state.viewport.position, resetSelectedStep, context.state, context.stateModifier);
    }
    constructor(startPosition, resetSelectedStep, state, stateModifier) {
        this.startPosition = startPosition;
        this.resetSelectedStep = resetSelectedStep;
        this.state = state;
        this.stateModifier = stateModifier;
    }
    onStart() {
        // Nothing to do.
    }
    onMove(delta) {
        this.lastDelta = delta;
        this.state.setViewport({
            position: this.startPosition.subtract(delta),
            scale: this.state.viewport.scale
        });
    }
    onEnd() {
        if (this.resetSelectedStep) {
            const distance = this.lastDelta ? this.lastDelta.distance() : 0;
            if (distance > 2) {
                return;
            }
            this.stateModifier.tryResetSelectedStep();
        }
    }
}

class SelectStepBehavior {
    static create(pressedStepComponent, forceMove, context) {
        const isDragDisabled = forceMove ||
            context.state.isDragDisabled ||
            !context.stateModifier.isDraggable(pressedStepComponent.step, pressedStepComponent.parentSequence);
        return new SelectStepBehavior(pressedStepComponent, isDragDisabled, context.state, context.stateModifier, context);
    }
    constructor(pressedStepComponent, isDragDisabled, state, stateModifier, context) {
        this.pressedStepComponent = pressedStepComponent;
        this.isDragDisabled = isDragDisabled;
        this.state = state;
        this.stateModifier = stateModifier;
        this.context = context;
    }
    onStart() {
        // Nothing to do.
    }
    onMove(delta) {
        if (delta.distance() > 2) {
            const canDrag = !this.state.isReadonly && !this.isDragDisabled;
            if (canDrag) {
                this.stateModifier.tryResetSelectedStep();
                return DragStepBehavior.create(this.context, this.pressedStepComponent.step, this.pressedStepComponent);
            }
            else {
                return MoveViewportBehavior.create(false, this.context);
            }
        }
    }
    onEnd(interrupt) {
        if (interrupt) {
            return;
        }
        if (this.stateModifier.isSelectable(this.pressedStepComponent.step, this.pressedStepComponent.parentSequence)) {
            this.stateModifier.trySelectStepById(this.pressedStepComponent.step.id);
        }
        else {
            // If the step is not selectable, we try to reset the selection.
            this.stateModifier.tryResetSelectedStep();
        }
        return new SelectStepBehaviorEndToken(this.pressedStepComponent.step.id, Date.now());
    }
}

class PressingBehavior {
    static create(clickedElement, handler) {
        return new PressingBehavior(clickedElement, handler);
    }
    constructor(clickedElement, handler) {
        this.clickedElement = clickedElement;
        this.handler = handler;
    }
    onStart() {
        // Nothing...
    }
    onMove() {
        // Nothing...
    }
    onEnd(interrupt, element) {
        if (!interrupt && element && this.clickedElement === element) {
            this.handler.handle();
        }
    }
}

class RerenderStepPressingBehaviorHandler {
    constructor(command, designerContext) {
        this.command = command;
        this.designerContext = designerContext;
    }
    handle() {
        if (this.command.beforeCallback) {
            this.command.beforeCallback();
        }
        this.designerContext.workspaceController.updateRootComponent();
    }
}

class OpenFolderPressingBehaviorHandler {
    constructor(command, designerContext) {
        this.command = command;
        this.designerContext = designerContext;
    }
    handle() {
        const stepId = this.command.step.id;
        this.designerContext.state.pushStepIdToFolderPath(stepId);
    }
}

class TriggerCustomActionPressingBehaviorHandler {
    constructor(command, customActionController) {
        this.command = command;
        this.customActionController = customActionController;
    }
    handle() {
        this.customActionController.trigger(this.command.action, this.command.step, this.command.sequence);
    }
}

class ClickBehaviorResolver {
    constructor(context) {
        this.context = context;
    }
    resolve(commandOrNull, element, forceMove) {
        if (!commandOrNull) {
            return MoveViewportBehavior.create(!forceMove, this.context);
        }
        switch (commandOrNull.type) {
            case ClickCommandType.selectStep:
                return SelectStepBehavior.create(commandOrNull.component, forceMove, this.context);
            case ClickCommandType.rerenderStep:
                return PressingBehavior.create(element, new RerenderStepPressingBehaviorHandler(commandOrNull, this.context));
            case ClickCommandType.openFolder:
                return PressingBehavior.create(element, new OpenFolderPressingBehaviorHandler(commandOrNull, this.context));
            case ClickCommandType.triggerCustomAction:
                return PressingBehavior.create(element, new TriggerCustomActionPressingBehaviorHandler(commandOrNull, this.context.customActionController));
            default:
                throw new Error('Not supported behavior type');
        }
    }
}

class BadgesResultFactory {
    static create(services) {
        return services.badges.map(ext => ext.createStartValue());
    }
}

function findValidationBadgeIndex(extensions) {
    return extensions.findIndex(ext => ext.id === 'validationError');
}

class ContextMenu {
    static create(shadowRoot, position, theme, items) {
        const menu = document.createElement('div');
        menu.style.left = `${position.x}px`;
        menu.style.top = `${position.y}px`;
        menu.className = `sqd-context-menu sqd-theme-${theme}`;
        const elements = [];
        for (let index = 0; index < items.length; index++) {
            const item = items[index];
            const element = document.createElement('div');
            if (item.callback) {
                element.className = 'sqd-context-menu-item';
                element.innerText = item.label;
            }
            else {
                element.className = 'sqd-context-menu-group';
                element.innerText = item.label;
            }
            elements.push(element);
            menu.appendChild(element);
        }
        const body = shadowRoot !== null && shadowRoot !== void 0 ? shadowRoot : document.body;
        const dom = shadowRoot !== null && shadowRoot !== void 0 ? shadowRoot : document;
        const instance = new ContextMenu(body, dom, menu, elements, items, Date.now());
        dom.addEventListener('mousedown', instance.mouseDown, false);
        dom.addEventListener('mouseup', instance.mouseUp, false);
        dom.addEventListener('touchstart', instance.mouseDown, false);
        dom.addEventListener('touchend', instance.mouseUp, false);
        body.appendChild(menu);
        return instance;
    }
    constructor(body, dom, menu, elements, items, startTime) {
        this.body = body;
        this.dom = dom;
        this.menu = menu;
        this.elements = elements;
        this.items = items;
        this.startTime = startTime;
        this.isAttached = true;
        this.mouseDown = (e) => {
            const index = this.findIndex(e.target);
            if (index === null) {
                this.tryDestroy();
            }
            else {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        this.mouseUp = (e) => {
            const dt = Date.now() - this.startTime;
            if (dt < 300) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            try {
                const index = this.findIndex(e.target);
                if (index !== null) {
                    const item = this.items[index];
                    if (item.callback) {
                        item.callback();
                    }
                }
            }
            finally {
                this.tryDestroy();
            }
        };
    }
    findIndex(element) {
        for (let index = 0; index < this.elements.length; index++) {
            if (this.elements[index].contains(element)) {
                return index;
            }
        }
        return null;
    }
    tryDestroy() {
        if (this.isAttached) {
            this.body.removeChild(this.menu);
            this.dom.removeEventListener('mousedown', this.mouseDown, false);
            this.dom.removeEventListener('mouseup', this.mouseUp, false);
            this.dom.removeEventListener('touchstart', this.mouseDown, false);
            this.dom.removeEventListener('touchend', this.mouseUp, false);
            this.isAttached = false;
        }
    }
}

class ContextMenuController {
    constructor(theme, configuration, itemsBuilder) {
        this.theme = theme;
        this.configuration = configuration;
        this.itemsBuilder = itemsBuilder;
    }
    tryOpen(position, commandOrNull) {
        if (this.configuration.contextMenu === false) {
            // Context menu is disabled.
            return;
        }
        if (this.current) {
            this.current.tryDestroy();
        }
        const items = this.itemsBuilder.build(commandOrNull);
        this.current = ContextMenu.create(this.configuration.shadowRoot, position, this.theme, items);
    }
    destroy() {
        if (this.current) {
            this.current.tryDestroy();
        }
    }
}

class ContextMenuItemsBuilder {
    constructor(viewportApi, workspaceApi, i18n, stateModifier, state, customMenuItemsProvider) {
        this.viewportApi = viewportApi;
        this.workspaceApi = workspaceApi;
        this.i18n = i18n;
        this.stateModifier = stateModifier;
        this.state = state;
        this.customMenuItemsProvider = customMenuItemsProvider;
    }
    build(commandOrNull) {
        const items = [];
        if (commandOrNull && commandOrNull.type === ClickCommandType.selectStep) {
            const ssc = commandOrNull;
            const step = ssc.component.step;
            const parentSequence = ssc.component.parentSequence;
            const name = this.i18n(`step.${step.type}.name`, step.name);
            items.push({
                label: name,
                order: 0
            });
            this.tryAppendCustomItems(items, step, parentSequence);
            if (this.stateModifier.isSelectable(step, parentSequence)) {
                if (this.state.selectedStepId === step.id) {
                    items.push({
                        label: this.i18n('contextMenu.unselect', 'Unselect'),
                        order: 10,
                        callback: () => {
                            this.stateModifier.tryResetSelectedStep();
                        }
                    });
                }
                else {
                    items.push({
                        label: this.i18n('contextMenu.select', 'Select'),
                        order: 20,
                        callback: () => {
                            this.stateModifier.trySelectStepById(step.id);
                        }
                    });
                }
            }
            if (!this.state.isReadonly) {
                if (this.stateModifier.isDeletable(step, parentSequence)) {
                    items.push({
                        label: this.i18n('contextMenu.delete', 'Delete'),
                        order: 30,
                        callback: () => {
                            this.stateModifier.tryDeleteById(step.id);
                        }
                    });
                }
                if (this.stateModifier.isDuplicable(step, parentSequence)) {
                    items.push({
                        label: this.i18n('contextMenu.duplicate', 'Duplicate'),
                        order: 40,
                        callback: () => {
                            this.stateModifier.tryDuplicate(step, parentSequence);
                        }
                    });
                }
            }
        }
        else if (!commandOrNull) {
            const rootSequence = this.workspaceApi.getRootSequence();
            this.tryAppendCustomItems(items, null, rootSequence.sequence);
        }
        items.push({
            label: this.i18n('contextMenu.resetView', 'Reset view'),
            order: 50,
            callback: () => {
                this.viewportApi.resetViewport();
            }
        });
        items.sort((a, b) => a.order - b.order);
        return items;
    }
    tryAppendCustomItems(items, step, parentSequence) {
        if (this.customMenuItemsProvider) {
            const customItems = this.customMenuItemsProvider.getItems(step, parentSequence, this.state.definition);
            for (const customItem of customItems) {
                items.push(customItem);
            }
        }
    }
}

const nonPassiveOptions = {
    passive: false
};
const notInitializedError = 'State is not initialized';
class PinchToZoomController {
    static create(workspaceApi, viewportApi, shadowRoot) {
        return new PinchToZoomController(workspaceApi, viewportApi, shadowRoot);
    }
    constructor(workspaceApi, viewportApi, shadowRoot) {
        this.workspaceApi = workspaceApi;
        this.viewportApi = viewportApi;
        this.shadowRoot = shadowRoot;
        this.state = null;
        this.onTouchMove = (e) => {
            e.preventDefault();
            if (!this.state) {
                throw new Error(notInitializedError);
            }
            const touchEvent = e;
            const distance = calculateFingerDistance(touchEvent);
            const centerPoint = readFingerCenterPoint(touchEvent);
            const deltaCenterPoint = centerPoint.subtract(this.state.lastCenterPoint);
            const scale = this.viewportApi.limitScale(this.state.startScale * (distance / this.state.startDistance));
            const zoomPoint = centerPoint.subtract(this.state.canvasPosition);
            const zoomRealPoint = zoomPoint
                .divideByScalar(this.state.lastViewport.scale)
                .subtract(this.state.lastViewport.position.divideByScalar(this.state.lastViewport.scale));
            const position = zoomRealPoint.multiplyByScalar(-scale).add(zoomPoint).add(deltaCenterPoint);
            const newViewport = {
                position,
                scale
            };
            this.workspaceApi.setViewport(newViewport);
            this.state.lastCenterPoint = centerPoint;
            this.state.lastViewport = newViewport;
        };
        this.onTouchEnd = (e) => {
            e.preventDefault();
            if (!this.state) {
                throw new Error(notInitializedError);
            }
            if (this.shadowRoot) {
                this.unbind(this.shadowRoot);
            }
            this.unbind(window);
            this.state = null;
        };
    }
    start(startDistance, centerPoint) {
        if (this.state) {
            throw new Error(`State is already initialized`);
        }
        if (this.shadowRoot) {
            this.bind(this.shadowRoot);
        }
        this.bind(window);
        const viewport = this.workspaceApi.getViewport();
        this.state = {
            canvasPosition: this.workspaceApi.getCanvasPosition(),
            startScale: viewport.scale,
            startDistance,
            lastViewport: viewport,
            lastCenterPoint: centerPoint
        };
    }
    bind(target) {
        target.addEventListener('touchmove', this.onTouchMove, nonPassiveOptions);
        target.addEventListener('touchend', this.onTouchEnd, nonPassiveOptions);
    }
    unbind(target) {
        target.removeEventListener('touchmove', this.onTouchMove, nonPassiveOptions);
        target.removeEventListener('touchend', this.onTouchEnd, nonPassiveOptions);
    }
}

class Workspace {
    static create(parent, designerContext, api) {
        var _a;
        const view = WorkspaceView.create(parent, designerContext.componentContext);
        const clickBehaviorResolver = new ClickBehaviorResolver(designerContext);
        const clickBehaviorWrapper = designerContext.services.clickBehaviorWrapperExtension.create(designerContext.customActionController);
        const wheelController = designerContext.services.wheelController.create(api.viewport, api.workspace);
        const pinchToZoomController = PinchToZoomController.create(api.workspace, api.viewport, api.shadowRoot);
        const contextMenuItemsBuilder = new ContextMenuItemsBuilder(api.viewport, api.workspace, api.i18n, designerContext.stateModifier, designerContext.state, ((_a = designerContext.services.contextMenu) === null || _a === void 0 ? void 0 : _a.createItemsProvider)
            ? designerContext.services.contextMenu.createItemsProvider(designerContext.customActionController)
            : undefined);
        const contextMenuController = new ContextMenuController(designerContext.theme, designerContext.configuration, contextMenuItemsBuilder);
        const workspace = new Workspace(view, designerContext.state, designerContext.behaviorController, wheelController, pinchToZoomController, contextMenuController, clickBehaviorResolver, clickBehaviorWrapper, api.viewport, api.workspace, designerContext.services);
        designerContext.setWorkspaceController(workspace);
        designerContext.state.onViewportChanged.subscribe(workspace.onViewportChanged);
        race(0, designerContext.state.onDefinitionChanged, designerContext.state.onSelectedStepIdChanged, designerContext.state.onFolderPathChanged).subscribe(r => {
            workspace.onStateChanged(r[0], r[1], r[2]);
        });
        view.bindMouseDown(workspace.onClick);
        view.bindTouchStart(workspace.onClick, workspace.onPinchToZoom);
        view.bindWheel(workspace.onWheel);
        view.bindContextMenu(workspace.onContextMenu);
        workspace.scheduleInit();
        return workspace;
    }
    constructor(view, state, behaviorController, wheelController, pinchToZoomController, contextMenuController, clickBehaviorResolver, clickBehaviorWrapper, viewportApi, workspaceApi, services) {
        this.view = view;
        this.state = state;
        this.behaviorController = behaviorController;
        this.wheelController = wheelController;
        this.pinchToZoomController = pinchToZoomController;
        this.contextMenuController = contextMenuController;
        this.clickBehaviorResolver = clickBehaviorResolver;
        this.clickBehaviorWrapper = clickBehaviorWrapper;
        this.viewportApi = viewportApi;
        this.workspaceApi = workspaceApi;
        this.services = services;
        this.onRendered = new SimpleEvent();
        this.isValid = false;
        this.initTimeout = null;
        this.selectedStepComponent = null;
        this.validationErrorBadgeIndex = null;
        this.onClick = (position, target, buttonIndex, altKey) => {
            const isPrimaryButton = buttonIndex === 0;
            const isMiddleButton = buttonIndex === 1;
            if (isPrimaryButton || isMiddleButton) {
                const forceMove = isMiddleButton || altKey;
                const commandOrNull = this.resolveClick(target, position);
                const behavior = this.clickBehaviorResolver.resolve(commandOrNull, target, forceMove);
                const wrappedBehavior = this.clickBehaviorWrapper.wrap(behavior, commandOrNull);
                this.behaviorController.start(position, wrappedBehavior);
            }
        };
        this.onPinchToZoom = (distance, centerPoint) => {
            this.pinchToZoomController.start(distance, centerPoint);
        };
        this.onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.wheelController.onWheel(e);
        };
        this.onContextMenu = (position, target) => {
            const commandOrNull = this.resolveClick(target, position);
            this.contextMenuController.tryOpen(position, commandOrNull);
        };
        this.onViewportChanged = (viewport) => {
            this.view.setPositionAndScale(viewport.position, viewport.scale);
        };
    }
    scheduleInit() {
        this.initTimeout = setTimeout(() => {
            this.initTimeout = null;
            this.updateRootComponent();
            this.viewportApi.resetViewport();
        });
    }
    updateRootComponent() {
        this.selectedStepComponent = null;
        const rootSequence = this.workspaceApi.getRootSequence();
        const parentPlaceIndicator = rootSequence.parentStep
            ? {
                sequence: rootSequence.parentStep.parentSequence,
                index: rootSequence.parentStep.index
            }
            : null;
        this.view.render(rootSequence.sequence, parentPlaceIndicator);
        this.trySelectStepComponent(this.state.selectedStepId);
        this.updateBadges();
        this.onRendered.forward();
    }
    updateBadges() {
        const result = BadgesResultFactory.create(this.services);
        this.getRootComponent().updateBadges(result);
        if (this.validationErrorBadgeIndex === null) {
            this.validationErrorBadgeIndex = findValidationBadgeIndex(this.services.badges);
        }
        this.isValid = Boolean(result[this.validationErrorBadgeIndex]);
    }
    resolvePlaceholders(skipComponent) {
        const result = {
            placeholders: [],
            components: []
        };
        this.getRootComponent().resolvePlaceholders(skipComponent, result);
        return result;
    }
    getComponentByStepId(stepId) {
        const component = this.getRootComponent().findById(stepId);
        if (!component) {
            throw new Error(`Cannot find component for step id: ${stepId}`);
        }
        return component;
    }
    getCanvasPosition() {
        return this.view.getCanvasPosition();
    }
    getCanvasSize() {
        return this.view.getCanvasSize();
    }
    getRootComponentSize() {
        const view = this.getRootComponent().view;
        return new Vector(view.width, view.height);
    }
    updateCanvasSize() {
        setTimeout(() => this.view.refreshSize());
    }
    destroy() {
        if (this.initTimeout) {
            clearTimeout(this.initTimeout);
            this.initTimeout = null;
        }
        this.contextMenuController.destroy();
        this.view.destroy();
    }
    onStateChanged(definitionChanged, selectedStepIdChanged, folderPathChanged) {
        if (folderPathChanged) {
            this.updateRootComponent();
            this.viewportApi.resetViewport();
        }
        else if (definitionChanged) {
            if (definitionChanged.changeType === DefinitionChangeType.stepPropertyChanged) {
                this.updateBadges();
            }
            else {
                this.updateRootComponent();
            }
        }
        else if (selectedStepIdChanged !== undefined) {
            this.trySelectStepComponent(selectedStepIdChanged);
        }
    }
    trySelectStepComponent(stepId) {
        if (this.selectedStepComponent) {
            this.selectedStepComponent.setIsSelected(false);
            this.selectedStepComponent = null;
        }
        if (stepId) {
            this.selectedStepComponent = this.getRootComponent().findById(stepId);
            if (this.selectedStepComponent) {
                this.selectedStepComponent.setIsSelected(true);
            }
        }
    }
    resolveClick(element, position) {
        const click = {
            element,
            position,
            scale: this.state.viewport.scale
        };
        return this.getRootComponent().resolveClick(click);
    }
    getRootComponent() {
        if (this.view.rootComponent) {
            return this.view.rootComponent;
        }
        throw new Error('Root component not found');
    }
}

class DesignerView {
    static create(parent, designerContext, api) {
        const root = Dom.element('div', {
            class: `sqd-designer sqd-theme-${designerContext.theme}`
        });
        parent.appendChild(root);
        const workspace = Workspace.create(root, designerContext, api);
        const uiComponents = designerContext.services.uiComponents.map(factory => factory.create(root, api));
        const daemons = designerContext.services.daemons.map(factory => factory.create(api));
        const view = new DesignerView(root, designerContext.layoutController, workspace, uiComponents, daemons);
        view.applyLayout();
        window.addEventListener('resize', view.onResize, false);
        return view;
    }
    constructor(root, layoutController, workspace, uiComponents, daemons) {
        this.root = root;
        this.layoutController = layoutController;
        this.workspace = workspace;
        this.uiComponents = uiComponents;
        this.daemons = daemons;
        this.onResize = () => {
            this.updateLayout();
        };
    }
    updateLayout() {
        this.applyLayout();
        for (const component of this.uiComponents) {
            component.updateLayout();
        }
    }
    destroy() {
        var _a;
        window.removeEventListener('resize', this.onResize, false);
        this.workspace.destroy();
        this.uiComponents.forEach(component => component.destroy());
        this.daemons.forEach(daemon => daemon.destroy());
        (_a = this.root.parentElement) === null || _a === void 0 ? void 0 : _a.removeChild(this.root);
    }
    applyLayout() {
        const isMobile = this.layoutController.isMobile();
        Dom.toggleClass(this.root, !isMobile, 'sqd-layout-desktop');
        Dom.toggleClass(this.root, isMobile, 'sqd-layout-mobile');
    }
}

const SAFE_OFFSET = 10;
class DefaultDraggedComponent {
    static create(parent, step, _, componentContext) {
        const canvas = Dom.svg('svg');
        canvas.style.marginLeft = -10 + 'px';
        canvas.style.marginTop = -10 + 'px';
        parent.appendChild(canvas);
        const previewStepContext = {
            parentSequence: [],
            step,
            depth: 0,
            position: 0,
            isInputConnected: true,
            isOutputConnected: true,
            isPreview: true
        };
        const stepComponent = componentContext.stepComponentFactory.create(canvas, previewStepContext, componentContext);
        Dom.attrs(canvas, {
            width: stepComponent.view.width + SAFE_OFFSET * 2,
            height: stepComponent.view.height + SAFE_OFFSET * 2
        });
        Dom.translate(stepComponent.view.g, SAFE_OFFSET, SAFE_OFFSET);
        return new DefaultDraggedComponent(stepComponent.view.width, stepComponent.view.height);
    }
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    destroy() {
        // Nothing to destroy...
    }
}

class DefaultDraggedComponentExtension {
    constructor() {
        this.create = DefaultDraggedComponent.create;
    }
}

class ControlBarView {
    static create(parent, isUndoRedoSupported, i18n) {
        const root = Dom.element('div', {
            class: 'sqd-control-bar'
        });
        const resetButton = createButton(Icons.center, i18n('controlBar.resetView', 'Reset view'));
        root.appendChild(resetButton);
        const zoomInButton = createButton(Icons.zoomIn, i18n('controlBar.zoomIn', 'Zoom in'));
        root.appendChild(zoomInButton);
        const zoomOutButton = createButton(Icons.zoomOut, i18n('controlBar.zoomOut', 'Zoom out'));
        root.appendChild(zoomOutButton);
        let undoButton = null;
        let redoButton = null;
        if (isUndoRedoSupported) {
            undoButton = createButton(Icons.undo, i18n('controlBar.undo', 'Undo'));
            root.appendChild(undoButton);
            redoButton = createButton(Icons.redo, i18n('controlBar.redo', 'Redo'));
            root.appendChild(redoButton);
        }
        const disableDragButton = createButton(Icons.move, i18n('controlBar.turnOnOffDragAndDrop', 'Turn on/off drag and drop'));
        disableDragButton.classList.add('sqd-disabled');
        root.appendChild(disableDragButton);
        const deleteButton = createButton(Icons.delete, i18n('controlBar.deleteSelectedStep', 'Delete selected step'));
        deleteButton.classList.add('sqd-delete');
        deleteButton.classList.add('sqd-hidden');
        root.appendChild(deleteButton);
        parent.appendChild(root);
        return new ControlBarView(resetButton, zoomInButton, zoomOutButton, undoButton, redoButton, disableDragButton, deleteButton);
    }
    constructor(resetButton, zoomInButton, zoomOutButton, undoButton, redoButton, disableDragButton, deleteButton) {
        this.resetButton = resetButton;
        this.zoomInButton = zoomInButton;
        this.zoomOutButton = zoomOutButton;
        this.undoButton = undoButton;
        this.redoButton = redoButton;
        this.disableDragButton = disableDragButton;
        this.deleteButton = deleteButton;
    }
    bindResetButtonClick(handler) {
        bindClick(this.resetButton, handler);
    }
    bindZoomInButtonClick(handler) {
        bindClick(this.zoomInButton, handler);
    }
    bindZoomOutButtonClick(handler) {
        bindClick(this.zoomOutButton, handler);
    }
    bindUndoButtonClick(handler) {
        if (!this.undoButton) {
            throw new Error('Undo button is disabled');
        }
        bindClick(this.undoButton, handler);
    }
    bindRedoButtonClick(handler) {
        if (!this.redoButton) {
            throw new Error('Redo button is disabled');
        }
        bindClick(this.redoButton, handler);
    }
    bindDisableDragButtonClick(handler) {
        bindClick(this.disableDragButton, handler);
    }
    bindDeleteButtonClick(handler) {
        bindClick(this.deleteButton, handler);
    }
    setIsDeleteButtonHidden(isHidden) {
        Dom.toggleClass(this.deleteButton, isHidden, 'sqd-hidden');
    }
    setDisableDragButtonDisabled(isDisabled) {
        Dom.toggleClass(this.disableDragButton, isDisabled, 'sqd-disabled');
    }
    setUndoButtonDisabled(isDisabled) {
        if (!this.undoButton) {
            throw new Error('Undo button is disabled');
        }
        Dom.toggleClass(this.undoButton, isDisabled, 'sqd-disabled');
    }
    setRedoButtonDisabled(isDisabled) {
        if (!this.redoButton) {
            throw new Error('Redo button is disabled');
        }
        Dom.toggleClass(this.redoButton, isDisabled, 'sqd-disabled');
    }
}
function bindClick(element, handler) {
    element.addEventListener('click', e => {
        e.preventDefault();
        handler();
    }, false);
}
function createButton(d, title) {
    const button = Dom.element('div', {
        class: 'sqd-control-bar-button',
        title
    });
    const icon = Icons.createSvg('sqd-control-bar-button-icon', d);
    button.appendChild(icon);
    return button;
}

class ControlBar {
    static create(parent, api) {
        const isUndoRedoSupported = api.controlBar.isUndoRedoSupported();
        const view = ControlBarView.create(parent, isUndoRedoSupported, api.i18n);
        const bar = new ControlBar(view, api.controlBar, api.viewport, isUndoRedoSupported);
        view.bindResetButtonClick(() => bar.onResetButtonClicked());
        view.bindZoomInButtonClick(() => bar.onZoomInButtonClicked());
        view.bindZoomOutButtonClick(() => bar.onZoomOutButtonClicked());
        view.bindDisableDragButtonClick(() => bar.onMoveButtonClicked());
        view.bindDeleteButtonClick(() => bar.onDeleteButtonClicked());
        api.controlBar.onStateChanged.subscribe(() => bar.refreshButtons());
        if (isUndoRedoSupported) {
            view.bindUndoButtonClick(() => bar.onUndoButtonClicked());
            view.bindRedoButtonClick(() => bar.onRedoButtonClicked());
        }
        bar.refreshButtons();
        return bar;
    }
    constructor(view, controlBarApi, viewportApi, isUndoRedoSupported) {
        this.view = view;
        this.controlBarApi = controlBarApi;
        this.viewportApi = viewportApi;
        this.isUndoRedoSupported = isUndoRedoSupported;
    }
    updateLayout() {
        //
    }
    destroy() {
        //
    }
    onResetButtonClicked() {
        this.viewportApi.resetViewport();
    }
    onZoomInButtonClicked() {
        this.viewportApi.zoom(true);
    }
    onZoomOutButtonClicked() {
        this.viewportApi.zoom(false);
    }
    onMoveButtonClicked() {
        this.controlBarApi.toggleIsDragDisabled();
    }
    onUndoButtonClicked() {
        this.controlBarApi.tryUndo();
    }
    onRedoButtonClicked() {
        this.controlBarApi.tryRedo();
    }
    onDeleteButtonClicked() {
        this.controlBarApi.tryDelete();
    }
    refreshButtons() {
        this.refreshDeleteButtonVisibility();
        this.refreshIsDragDisabled();
        if (this.isUndoRedoSupported) {
            this.refreshUndoRedoAvailability();
        }
    }
    //
    refreshIsDragDisabled() {
        const isDragDisabled = this.controlBarApi.isDragDisabled();
        this.view.setDisableDragButtonDisabled(!isDragDisabled);
    }
    refreshUndoRedoAvailability() {
        const canUndo = this.controlBarApi.canUndo();
        const canRedo = this.controlBarApi.canRedo();
        this.view.setUndoButtonDisabled(!canUndo);
        this.view.setRedoButtonDisabled(!canRedo);
    }
    refreshDeleteButtonVisibility() {
        const canDelete = this.controlBarApi.canDelete();
        this.view.setIsDeleteButtonHidden(!canDelete);
    }
}

class ControlBarExtension {
    constructor() {
        this.create = ControlBar.create;
    }
}

const ignoreTagNames = ['INPUT', 'TEXTAREA', 'SELECT'];
class KeyboardDaemon {
    static create(api, configuration) {
        const dom = api.shadowRoot || document;
        const controller = new KeyboardDaemon(dom, api.controlBar, configuration);
        dom.addEventListener('keyup', controller.onKeyUp, false);
        return controller;
    }
    constructor(dom, controlBarApi, configuration) {
        this.dom = dom;
        this.controlBarApi = controlBarApi;
        this.configuration = configuration;
        this.onKeyUp = (e) => {
            const ke = e;
            const action = detectAction(ke);
            if (!action) {
                return;
            }
            if (document.activeElement && ignoreTagNames.includes(document.activeElement.tagName)) {
                return;
            }
            if (this.configuration.canHandleKey && !this.configuration.canHandleKey(action, ke)) {
                return;
            }
            const isDeletable = this.controlBarApi.canDelete();
            if (isDeletable) {
                e.preventDefault();
                e.stopPropagation();
                this.controlBarApi.tryDelete();
            }
        };
    }
    destroy() {
        this.dom.removeEventListener('keyup', this.onKeyUp, false);
    }
}
function detectAction(e) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
        return KeyboardAction.delete;
    }
    return null;
}

class KeyboardDaemonExtension {
    static create(configuration) {
        if (configuration === undefined || configuration === true) {
            configuration = {};
        }
        return new KeyboardDaemonExtension(configuration);
    }
    constructor(configuration) {
        this.configuration = configuration;
    }
    create(api) {
        return KeyboardDaemon.create(api, this.configuration);
    }
}

class SmartEditorView {
    static create(parent, api, i18n, configuration) {
        const root = Dom.element('div', {
            class: 'sqd-smart-editor'
        });
        const toggle = Dom.element('div', {
            class: 'sqd-smart-editor-toggle',
            title: i18n('smartEditor.toggle', 'Toggle editor')
        });
        parent.appendChild(toggle);
        parent.appendChild(root);
        const editor = Editor.create(root, api, 'sqd-editor sqd-step-editor', configuration.stepEditorProvider, 'sqd-editor sqd-root-editor', configuration.rootEditorProvider, null);
        return new SmartEditorView(root, toggle, editor);
    }
    constructor(root, toggle, editor) {
        this.root = root;
        this.toggle = toggle;
        this.editor = editor;
    }
    bindToggleClick(handler) {
        this.toggle.addEventListener('click', e => {
            e.preventDefault();
            handler();
        }, false);
    }
    setIsCollapsed(isCollapsed) {
        Dom.toggleClass(this.root, isCollapsed, 'sqd-hidden');
        Dom.toggleClass(this.toggle, isCollapsed, 'sqd-collapsed');
        if (this.toggleIcon) {
            this.toggle.removeChild(this.toggleIcon);
        }
        this.toggleIcon = Icons.createSvg('sqd-smart-editor-toggle-icon', isCollapsed ? Icons.options : Icons.close);
        this.toggle.appendChild(this.toggleIcon);
    }
    destroy() {
        this.editor.destroy();
    }
}

class SmartEditor {
    static create(parent, api, configuration) {
        const view = SmartEditorView.create(parent, api.editor, api.i18n, configuration);
        const editor = new SmartEditor(view, api.editor, api.workspace);
        editor.updateVisibility();
        view.bindToggleClick(() => editor.onToggleClicked());
        api.editor.subscribeIsCollapsed(() => editor.onIsCollapsedChanged());
        return editor;
    }
    constructor(view, editorApi, workspaceApi) {
        this.view = view;
        this.editorApi = editorApi;
        this.workspaceApi = workspaceApi;
    }
    onToggleClicked() {
        this.editorApi.toggleIsCollapsed();
    }
    setIsCollapsed(isCollapsed) {
        this.view.setIsCollapsed(isCollapsed);
    }
    onIsCollapsedChanged() {
        this.updateVisibility();
        this.workspaceApi.updateCanvasSize();
    }
    updateVisibility() {
        this.setIsCollapsed(this.editorApi.isCollapsed());
    }
    updateLayout() {
        //
    }
    destroy() {
        this.view.destroy();
    }
}

class SmartEditorExtension {
    constructor(configuration) {
        this.configuration = configuration;
    }
    create(root, api) {
        return SmartEditor.create(root, api, this.configuration);
    }
}

const MAX_DELTA_Y = 25;
const listenerOptions = {
    passive: false
};
class ScrollBoxView {
    static create(parent, viewport) {
        const root = Dom.element('div', {
            class: 'sqd-scrollbox'
        });
        parent.appendChild(root);
        const view = new ScrollBoxView(root, viewport);
        root.addEventListener('wheel', e => view.onWheel(e), listenerOptions);
        root.addEventListener('touchstart', e => view.onTouchStart(e), listenerOptions);
        root.addEventListener('mousedown', e => view.onMouseDown(e), false);
        return view;
    }
    constructor(root, viewport) {
        this.root = root;
        this.viewport = viewport;
        this.onTouchStart = (e) => {
            e.preventDefault();
            this.startScroll(readTouchPosition(e));
        };
        this.onMouseDown = (e) => {
            e.preventDefault();
            this.startScroll(readMousePosition(e));
        };
        this.onTouchMove = (e) => {
            e.preventDefault();
            this.moveScroll(readTouchPosition(e));
        };
        this.onMouseMove = (e) => {
            e.preventDefault();
            this.moveScroll(readMousePosition(e));
        };
        this.onTouchEnd = (e) => {
            e.preventDefault();
            this.stopScroll();
        };
        this.onMouseUp = (e) => {
            e.preventDefault();
            this.stopScroll();
        };
    }
    setContent(element) {
        if (this.content) {
            this.root.removeChild(this.content.element);
        }
        element.classList.add('sqd-scrollbox-body');
        this.root.appendChild(element);
        this.reload(element);
    }
    updateLayout() {
        if (this.content) {
            this.reload(this.content.element);
        }
    }
    destroy() {
        //
    }
    reload(element) {
        const maxHeightPercent = 0.7;
        const minDistance = 206;
        let height = Math.min(this.viewport.clientHeight * maxHeightPercent, element.clientHeight);
        height = Math.min(height, this.viewport.clientHeight - minDistance);
        this.root.style.height = height + 'px';
        element.style.top = '0px';
        this.content = {
            element,
            height
        };
    }
    onWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.content) {
            const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), MAX_DELTA_Y);
            const scrollTop = this.getScrollTop();
            this.setScrollTop(scrollTop - delta);
        }
    }
    startScroll(startPosition) {
        if (!this.scroll) {
            window.addEventListener('touchmove', this.onTouchMove, listenerOptions);
            window.addEventListener('mousemove', this.onMouseMove, false);
            window.addEventListener('touchend', this.onTouchEnd, listenerOptions);
            window.addEventListener('mouseup', this.onMouseUp, false);
        }
        this.scroll = {
            startPositionY: startPosition.y,
            startScrollTop: this.getScrollTop()
        };
    }
    moveScroll(position) {
        if (this.scroll) {
            const delta = position.y - this.scroll.startPositionY;
            this.setScrollTop(this.scroll.startScrollTop + delta);
        }
    }
    stopScroll() {
        if (this.scroll) {
            window.removeEventListener('touchmove', this.onTouchMove, listenerOptions);
            window.removeEventListener('mousemove', this.onMouseMove, false);
            window.removeEventListener('touchend', this.onTouchEnd, listenerOptions);
            window.removeEventListener('mouseup', this.onMouseUp, false);
            this.scroll = undefined;
        }
    }
    getScrollTop() {
        if (this.content && this.content.element.style.top) {
            return parseInt(this.content.element.style.top);
        }
        return 0;
    }
    setScrollTop(scrollTop) {
        if (this.content) {
            const max = this.content.element.clientHeight - this.content.height;
            const limited = Math.max(Math.min(scrollTop, 0), -max);
            this.content.element.style.top = limited + 'px';
        }
    }
}

class ToolboxItemView {
    static create(parent, data) {
        const root = Dom.element('div', {
            class: `sqd-toolbox-item sqd-type-${data.step.type}`,
            title: data.description
        });
        const icon = Dom.element('div', {
            class: 'sqd-toolbox-item-icon'
        });
        if (data.iconUrl) {
            const iconImage = Dom.element('img', {
                class: 'sqd-toolbox-item-icon-image',
                src: data.iconUrl,
                draggable: 'false'
            });
            icon.appendChild(iconImage);
        }
        else {
            icon.classList.add('sqd-no-icon');
        }
        const text = Dom.element('div', {
            class: 'sqd-toolbox-item-text'
        });
        text.textContent = data.label;
        root.appendChild(icon);
        root.appendChild(text);
        parent.appendChild(root);
        return new ToolboxItemView(root);
    }
    constructor(root) {
        this.root = root;
    }
    bindMousedown(handler) {
        this.root.addEventListener('mousedown', handler, false);
    }
    bindTouchstart(handler) {
        this.root.addEventListener('touchstart', handler, false);
    }
    bindContextMenu(handler) {
        this.root.addEventListener('contextmenu', handler, false);
    }
}

class ToolboxItem {
    static create(parent, data, api) {
        const view = ToolboxItemView.create(parent, data);
        const item = new ToolboxItem(data.step, api);
        view.bindMousedown(e => item.onMousedown(e));
        view.bindTouchstart(e => item.onTouchstart(e));
        view.bindContextMenu(e => item.onContextMenu(e));
        return item;
    }
    constructor(step, api) {
        this.step = step;
        this.api = api;
    }
    onTouchstart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            // We stop propagation only if it was a single touch event (we can start dragging).
            // Otherwise we want to bubble up the event to the scrollbox.
            e.stopPropagation();
            this.tryDrag(readTouchPosition(e));
        }
    }
    onMousedown(e) {
        e.preventDefault();
        e.stopPropagation();
        const isPrimaryButton = e.button === 0;
        if (isPrimaryButton) {
            this.tryDrag(readMousePosition(e));
        }
    }
    onContextMenu(e) {
        e.preventDefault();
    }
    tryDrag(position) {
        this.api.tryDrag(position, this.step);
    }
}

class ToolboxView {
    static create(parent, api, i18n) {
        const root = Dom.element('div', {
            class: 'sqd-toolbox'
        });
        const header = Dom.element('div', {
            class: 'sqd-toolbox-header'
        });
        const headerTitle = Dom.element('div', {
            class: 'sqd-toolbox-header-title'
        });
        headerTitle.innerText = i18n('toolbox.title', 'Toolbox');
        const body = Dom.element('div', {
            class: 'sqd-toolbox-body'
        });
        const filter = Dom.element('div', {
            class: 'sqd-toolbox-filter'
        });
        const filterInput = Dom.element('input', {
            class: 'sqd-toolbox-filter-input',
            type: 'text',
            placeholder: i18n('toolbox.search', 'Search...')
        });
        root.appendChild(header);
        root.appendChild(body);
        header.appendChild(headerTitle);
        filter.appendChild(filterInput);
        body.appendChild(filter);
        parent.appendChild(root);
        const scrollBoxView = ScrollBoxView.create(body, parent);
        return new ToolboxView(header, body, filterInput, scrollBoxView, api);
    }
    constructor(header, body, filterInput, scrollBoxView, api) {
        this.header = header;
        this.body = body;
        this.filterInput = filterInput;
        this.scrollBoxView = scrollBoxView;
        this.api = api;
    }
    updateLayout() {
        this.scrollBoxView.updateLayout();
    }
    bindToggleClick(handler) {
        function forward(e) {
            e.preventDefault();
            handler();
        }
        this.header.addEventListener('click', forward, false);
    }
    bindFilterInputChange(handler) {
        function forward(e) {
            handler(e.target.value);
        }
        this.filterInput.addEventListener('keyup', forward, false);
        this.filterInput.addEventListener('blur', forward, false);
    }
    setIsCollapsed(isCollapsed) {
        Dom.toggleClass(this.body, isCollapsed, 'sqd-hidden');
        if (this.headerToggleIcon) {
            this.header.removeChild(this.headerToggleIcon);
        }
        this.headerToggleIcon = Icons.createSvg('sqd-toolbox-toggle-icon', isCollapsed ? Icons.expand : Icons.close);
        this.header.appendChild(this.headerToggleIcon);
        if (!isCollapsed) {
            this.updateLayout();
        }
    }
    setGroups(groups) {
        const list = Dom.element('div');
        groups.forEach(group => {
            const groupTitle = Dom.element('div', {
                class: 'sqd-toolbox-group-title'
            });
            groupTitle.innerText = group.name;
            list.appendChild(groupTitle);
            group.items.forEach(item => ToolboxItem.create(list, item, this.api));
        });
        this.scrollBoxView.setContent(list);
    }
    destroy() {
        this.scrollBoxView.destroy();
    }
}

class Toolbox {
    static create(root, api, i18n) {
        const allGroups = api.getAllGroups();
        const view = ToolboxView.create(root, api, i18n);
        const toolbox = new Toolbox(view, api, allGroups);
        toolbox.render();
        toolbox.onIsCollapsedChanged();
        view.bindToggleClick(() => toolbox.onToggleClicked());
        view.bindFilterInputChange(v => toolbox.onFilterInputChanged(v));
        api.subscribeIsCollapsed(() => toolbox.onIsCollapsedChanged());
        return toolbox;
    }
    constructor(view, api, allGroups) {
        this.view = view;
        this.api = api;
        this.allGroups = allGroups;
    }
    updateLayout() {
        this.view.updateLayout();
    }
    destroy() {
        this.view.destroy();
    }
    render() {
        const groups = this.api.applyFilter(this.allGroups, this.filter);
        this.view.setGroups(groups);
    }
    onIsCollapsedChanged() {
        this.view.setIsCollapsed(this.api.isCollapsed());
    }
    onToggleClicked() {
        this.api.toggleIsCollapsed();
    }
    onFilterInputChanged(value) {
        this.filter = value;
        this.render();
    }
}

class ToolboxExtension {
    create(root, api) {
        return Toolbox.create(root, api.toolbox, api.i18n);
    }
}

class DefaultSequenceComponentExtension {
    constructor() {
        this.create = DefaultSequenceComponent.create;
    }
}

class DefaultStepComponentViewWrapperExtension {
    constructor() {
        this.wrap = (view) => view;
    }
}

class DefaultClickBehaviorWrapper {
    constructor() {
        this.wrap = (behavior) => behavior;
    }
}

class DefaultClickBehaviorWrapperExtension {
    create() {
        return new DefaultClickBehaviorWrapper();
    }
}

class DefaultStepBadgesDecoratorExtension {
    create(g, view, badges) {
        const position = new Vector(view.width, 0);
        return new DefaultBadgesDecorator(position, badges, g);
    }
}

class ServicesResolver {
    static resolve(extensions, configuration) {
        const services = {};
        merge(services, extensions || []);
        setDefaults(services, configuration);
        return services;
    }
}
function merge(services, extensions) {
    for (const ext of extensions) {
        if (ext.steps) {
            services.steps = (services.steps || []).concat(ext.steps);
        }
        if (ext.stepComponentViewWrapper) {
            services.stepComponentViewWrapper = ext.stepComponentViewWrapper;
        }
        if (ext.stepBadgesDecorator) {
            services.stepBadgesDecorator = ext.stepBadgesDecorator;
        }
        if (ext.clickBehaviorWrapperExtension) {
            services.clickBehaviorWrapperExtension = ext.clickBehaviorWrapperExtension;
        }
        if (ext.badges) {
            services.badges = (services.badges || []).concat(ext.badges);
        }
        if (ext.uiComponents) {
            services.uiComponents = (services.uiComponents || []).concat(ext.uiComponents);
        }
        if (ext.draggedComponent) {
            services.draggedComponent = ext.draggedComponent;
        }
        if (ext.wheelController) {
            services.wheelController = ext.wheelController;
        }
        if (ext.placeholder) {
            services.placeholder = ext.placeholder;
        }
        if (ext.regionComponentView) {
            services.regionComponentView = ext.regionComponentView;
        }
        if (ext.viewportController) {
            services.viewportController = ext.viewportController;
        }
        if (ext.grid) {
            services.grid = ext.grid;
        }
        if (ext.rootComponent) {
            services.rootComponent = ext.rootComponent;
        }
        if (ext.sequenceComponent) {
            services.sequenceComponent = ext.sequenceComponent;
        }
        if (ext.contextMenu) {
            services.contextMenu = ext.contextMenu;
        }
        if (ext.daemons) {
            services.daemons = (services.daemons || []).concat(ext.daemons);
        }
    }
}
function setDefaults(services, configuration) {
    if (!services.steps) {
        services.steps = [];
    }
    services.steps.push(ContainerStepExtension.create());
    services.steps.push(SwitchStepExtension.create());
    services.steps.push(TaskStepExtension.create());
    services.steps.push(LaunchPadStepExtension.create());
    if (!services.stepComponentViewWrapper) {
        services.stepComponentViewWrapper = new DefaultStepComponentViewWrapperExtension();
    }
    if (!services.stepBadgesDecorator) {
        services.stepBadgesDecorator = new DefaultStepBadgesDecoratorExtension();
    }
    if (!services.clickBehaviorWrapperExtension) {
        services.clickBehaviorWrapperExtension = new DefaultClickBehaviorWrapperExtension();
    }
    if (!services.badges) {
        services.badges = [];
    }
    if (findValidationBadgeIndex(services.badges) < 0) {
        services.badges.push(ValidationErrorBadgeExtension.create());
    }
    if (!services.draggedComponent) {
        services.draggedComponent = new DefaultDraggedComponentExtension();
    }
    if (!services.uiComponents) {
        services.uiComponents = [];
    }
    if (configuration.controlBar) {
        services.uiComponents.push(new ControlBarExtension());
    }
    if (configuration.editors) {
        services.uiComponents.push(new SmartEditorExtension(configuration.editors));
    }
    if (configuration.toolbox) {
        services.uiComponents.push(new ToolboxExtension());
    }
    if (!services.wheelController) {
        services.wheelController = new ClassicWheelControllerExtension();
    }
    if (!services.placeholder) {
        services.placeholder = RectPlaceholderExtension.create();
    }
    if (!services.regionComponentView) {
        services.regionComponentView = new DefaultRegionComponentViewExtension();
    }
    if (!services.viewportController) {
        services.viewportController = DefaultViewportControllerExtension.create();
    }
    if (!services.grid) {
        services.grid = LineGridExtension.create();
    }
    if (!services.rootComponent) {
        services.rootComponent = StartStopRootComponentExtension.create();
    }
    if (!services.sequenceComponent) {
        services.sequenceComponent = new DefaultSequenceComponentExtension();
    }
    if (!services.daemons) {
        services.daemons = [];
    }
    if (configuration.keyboard === undefined || configuration.keyboard) {
        services.daemons.push(KeyboardDaemonExtension.create(configuration.keyboard));
    }
}

function validateConfiguration(configuration) {
    const validateProperty = (key) => {
        if (configuration[key] === undefined) {
            throw new Error(`The "${key}" property is not defined in the configuration`);
        }
    };
    if (!configuration) {
        throw new Error('Configuration is not defined');
    }
    validateProperty('steps');
    validateProperty('toolbox');
    validateProperty('editors');
    validateProperty('controlBar');
}

class Designer {
    /**
     * Creates a designer.
     * @param placeholder Placeholder where the designer will be attached.
     * @param startDefinition Start definition of a flow.
     * @param configuration Designer's configuration.
     * @returns An instance of the designer.
     */
    static create(placeholder, startDefinition, configuration) {
        var _a;
        if (!placeholder) {
            throw new Error('Placeholder is not defined');
        }
        if (!startDefinition) {
            throw new Error('Start definition is not defined');
        }
        const config = configuration;
        validateConfiguration(config);
        if (!isElementAttached((_a = config.shadowRoot) !== null && _a !== void 0 ? _a : document, placeholder)) {
            throw new Error('Placeholder is not attached to the DOM');
        }
        const services = ServicesResolver.resolve(configuration.extensions, config);
        const designerContext = DesignerContext.create(placeholder, startDefinition, config, services);
        const designerApi = DesignerApi.create(designerContext);
        const view = DesignerView.create(placeholder, designerContext, designerApi);
        const designer = new Designer(view, designerContext.state, designerContext.stateModifier, designerContext.definitionWalker, designerContext.historyController, designerApi);
        view.workspace.onRendered.first().then(designer.onReady.forward);
        race(0, designerContext.state.onDefinitionChanged, designerContext.state.onSelectedStepIdChanged).subscribe(([definition, selectedStepId]) => {
            if (definition !== undefined) {
                designer.onDefinitionChanged.forward(designerContext.state.definition);
            }
            if (selectedStepId !== undefined) {
                designer.onSelectedStepIdChanged.forward(designerContext.state.selectedStepId);
            }
        });
        designerContext.state.onViewportChanged.subscribe(designer.onViewportChanged.forward);
        designerContext.state.onIsToolboxCollapsedChanged.subscribe(designer.onIsToolboxCollapsedChanged.forward);
        designerContext.state.onIsEditorCollapsedChanged.subscribe(designer.onIsEditorCollapsedChanged.forward);
        designerContext.state.onStepUnselectionBlocked.subscribe(designer.onStepUnselectionBlocked.forward);
        return designer;
    }
    constructor(view, state, stateModifier, walker, historyController, api) {
        this.view = view;
        this.state = state;
        this.stateModifier = stateModifier;
        this.walker = walker;
        this.historyController = historyController;
        this.api = api;
        /**
         * @description Fires when the designer is initialized and ready to use.
         */
        this.onReady = new SimpleEvent();
        /**
         * @description Fires when the definition has changed.
         */
        this.onDefinitionChanged = new SimpleEvent();
        /**
         * @description Fires when the viewport has changed.
         */
        this.onViewportChanged = new SimpleEvent();
        /**
         * @description Fires when the selected step has changed.
         */
        this.onSelectedStepIdChanged = new SimpleEvent();
        /**
         * @description Fires when the designer could not unselect the currently selected step due to restrictions.
         */
        this.onStepUnselectionBlocked = new SimpleEvent();
        /**
         * @description Fires when the toolbox is collapsed or expanded.
         */
        this.onIsToolboxCollapsedChanged = new SimpleEvent();
        /**
         * @description Fires when the editor is collapsed or expanded.
         */
        this.onIsEditorCollapsedChanged = new SimpleEvent();
    }
    /**
     * @returns the current definition of the workflow.
     */
    getDefinition() {
        return this.state.definition;
    }
    /**
     * @returns the validation result of the current definition.
     */
    isValid() {
        return this.view.workspace.isValid;
    }
    /**
     * @returns the readonly flag.
     */
    isReadonly() {
        return this.state.isReadonly;
    }
    /**
     * @description Changes the readonly flag.
     */
    setIsReadonly(isReadonly) {
        this.state.setIsReadonly(isReadonly);
    }
    /**
     * @returns current selected step id or `null` if nothing is selected.
     */
    getSelectedStepId() {
        return this.state.selectedStepId;
    }
    /**
     * @description Selects a step by the id.
     */
    selectStepById(stepId) {
        this.state.setSelectedStepId(stepId);
    }
    /**
     * @description Unselects the selected step.
     */
    clearSelectedStep() {
        this.state.setSelectedStepId(null);
    }
    /**
     * @returns the current viewport.
     */
    getViewport() {
        return this.state.viewport;
    }
    /**
     * @description Sets the viewport.
     * @param viewport Viewport.
     */
    setViewport(viewport) {
        this.state.setViewport(viewport);
    }
    /**
     * @description Resets the viewport.
     */
    resetViewport() {
        this.api.viewport.resetViewport();
    }
    /**
     * @description Moves the viewport to the step with the animation.
     */
    moveViewportToStep(stepId) {
        this.api.viewport.moveViewportToStep(stepId);
    }
    /**
     * @description Rerender the root component and all its children.
     */
    updateRootComponent() {
        this.api.workspace.updateRootComponent();
    }
    /**
     * @description Updates the layout of the designer.
     */
    updateLayout() {
        this.api.workspace.updateCanvasSize();
        this.view.updateLayout();
    }
    /**
     * @description Updates all badges.
     */
    updateBadges() {
        this.api.workspace.updateBadges();
    }
    /**
     * @returns a flag that indicates whether the toolbox is collapsed.
     */
    isToolboxCollapsed() {
        return this.state.isToolboxCollapsed;
    }
    /**
     * @description Sets a flag that indicates whether the toolbox is collapsed.
     */
    setIsToolboxCollapsed(isCollapsed) {
        this.state.setIsToolboxCollapsed(isCollapsed);
    }
    /**
     * @returns a flag that indicates whether the editor is collapsed.
     */
    isEditorCollapsed() {
        return this.state.isEditorCollapsed;
    }
    /**
     * @description Sets a flag that indicates whether the editor is collapsed.
     */
    setIsEditorCollapsed(isCollapsed) {
        this.state.setIsEditorCollapsed(isCollapsed);
    }
    /**
     * @description Dump the undo stack.
     */
    dumpUndoStack() {
        return this.getHistoryController().dump();
    }
    /**
     * Replaces the current definition with a new one and adds the previous definition to the undo stack.
     * @param definition A new definition.
     */
    replaceDefinition(definition) {
        return __awaiter(this, void 0, void 0, function* () {
            this.getHistoryController().replaceDefinition(definition);
            yield Promise.all([
                this.view.workspace.onRendered.first(),
                this.onDefinitionChanged.first()
            ]);
        });
    }
    /**
     * @param needle A step, a sequence or a step id.
     * @returns parent steps and branch names.
     */
    getStepParents(needle) {
        return this.walker.getParents(this.state.definition, needle);
    }
    /**
     * @returns the definition walker.
     */
    getWalker() {
        return this.walker;
    }
    /**
     * @description Destroys the designer and deletes all nodes from the placeholder.
     */
    destroy() {
        this.view.destroy();
    }
    getHistoryController() {
        if (!this.historyController) {
            throw new Error('Undo feature is not activated');
        }
        return this.historyController;
    }
}




/***/ },

/***/ "./node_modules/sequential-workflow-model/lib/esm/index.js"
/*!*****************************************************************!*\
  !*** ./node_modules/sequential-workflow-model/lib/esm/index.js ***!
  \*****************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DefinitionWalker: () => (/* binding */ DefinitionWalker),
/* harmony export */   StepChildrenType: () => (/* binding */ StepChildrenType)
/* harmony export */ });
const defaultResolvers = [sequentialResolver, branchedResolver];
function branchedResolver(step) {
    const branches = step.branches;
    if (branches) {
        return { type: StepChildrenType.branches, items: branches };
    }
    return null;
}
function sequentialResolver(step) {
    const sequence = step.sequence;
    if (sequence) {
        return { type: StepChildrenType.sequence, items: sequence };
    }
    return null;
}

var StepChildrenType;
(function (StepChildrenType) {
    StepChildrenType[StepChildrenType["sequence"] = 1] = "sequence";
    StepChildrenType[StepChildrenType["branches"] = 2] = "branches";
})(StepChildrenType || (StepChildrenType = {}));
class DefinitionWalker {
    constructor(resolvers) {
        this.resolvers = resolvers ? resolvers.concat(defaultResolvers) : defaultResolvers;
    }
    /**
     * Returns children of the step. If the step doesn't have children, returns null.
     * @param step The step.
     */
    getChildren(step) {
        const count = this.resolvers.length;
        for (let i = 0; i < count; i++) {
            const result = this.resolvers[i](step);
            if (result) {
                return result;
            }
        }
        return null;
    }
    /**
     * Returns the parents of the step or the sequence.
     * @param definition The definition.
     * @param needle The step, stepId or sequence to find.
     * @returns The parents of the step or the sequence.
     */
    getParents(definition, needle) {
        const result = [];
        let searchSequence = null;
        let searchStepId = null;
        if (Array.isArray(needle)) {
            searchSequence = needle;
        }
        else if (typeof needle === 'string') {
            searchStepId = needle;
        }
        else {
            searchStepId = needle.id;
        }
        if (this.find(definition.sequence, searchSequence, searchStepId, result)) {
            result.reverse();
            return result.map(item => {
                return typeof item === 'string' ? item : item.step;
            });
        }
        throw new Error(searchStepId ? `Cannot get parents of step: ${searchStepId}` : 'Cannot get parents of sequence');
    }
    findParentSequence(definition, stepId) {
        const result = [];
        if (this.find(definition.sequence, null, stepId, result)) {
            return result[0];
        }
        return null;
    }
    getParentSequence(definition, stepId) {
        const result = this.findParentSequence(definition, stepId);
        if (!result) {
            throw new Error(`Cannot find step by id: ${stepId}`);
        }
        return result;
    }
    findById(definition, stepId) {
        const result = this.findParentSequence(definition, stepId);
        return result ? result.step : null;
    }
    getById(definition, stepId) {
        return this.getParentSequence(definition, stepId).step;
    }
    forEach(definition, callback) {
        this.iterateSequence(definition.sequence, callback);
    }
    forEachSequence(sequence, callback) {
        this.iterateSequence(sequence, callback);
    }
    forEachChildren(step, callback) {
        this.iterateStep(step, callback);
    }
    find(sequence, needSequence, needStepId, result) {
        if (needSequence && sequence === needSequence) {
            return true;
        }
        const count = sequence.length;
        for (let index = 0; index < count; index++) {
            const step = sequence[index];
            if (needStepId && step.id === needStepId) {
                result.push({ step, index, parentSequence: sequence });
                return true;
            }
            const children = this.getChildren(step);
            if (children) {
                switch (children.type) {
                    case StepChildrenType.sequence:
                        {
                            const parentSequence = children.items;
                            if (this.find(parentSequence, needSequence, needStepId, result)) {
                                result.push({ step, index, parentSequence });
                                return true;
                            }
                        }
                        break;
                    case StepChildrenType.branches:
                        {
                            const branches = children.items;
                            const branchNames = Object.keys(branches);
                            for (const branchName of branchNames) {
                                const parentSequence = branches[branchName];
                                if (this.find(parentSequence, needSequence, needStepId, result)) {
                                    result.push(branchName);
                                    result.push({ step, index, parentSequence });
                                    return true;
                                }
                            }
                        }
                        break;
                    default:
                        throw new Error(`Not supported step children type: ${children.type}`);
                }
            }
        }
        return false;
    }
    iterateSequence(sequence, callback) {
        const count = sequence.length;
        for (let index = 0; index < count; index++) {
            const step = sequence[index];
            if (callback(step, index, sequence) === false) {
                return false;
            }
            if (!this.iterateStep(step, callback)) {
                return false;
            }
        }
        return true;
    }
    iterateStep(step, callback) {
        const children = this.getChildren(step);
        if (children) {
            switch (children.type) {
                case StepChildrenType.sequence:
                    {
                        const sequence = children.items;
                        if (!this.iterateSequence(sequence, callback)) {
                            return false;
                        }
                    }
                    break;
                case StepChildrenType.branches:
                    {
                        const sequences = Object.values(children.items);
                        for (const sequence of sequences) {
                            if (!this.iterateSequence(sequence, callback)) {
                                return false;
                            }
                        }
                    }
                    break;
                default:
                    throw new Error(`Not supported step children type: ${children.type}`);
            }
        }
        return true;
    }
}




/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = (module) => {
/******/ 		const getter = module && module.__esModule ?
/******/ 			() => (module['default']) :
/******/ 			() => (module);
/******/ 		__webpack_require__.d(getter, { a: getter });
/******/ 		return getter;
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		__webpack_require__.b = (typeof document !== 'undefined' && document.baseURI) || self.location.href;
/******/ 		
/******/ 		// no installed chunks
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// no jsonp function
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/nonce */
/******/ 	__webpack_require__.nc = undefined;
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*********************************!*\
  !*** ./src/component/index.tsx ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   QSequentialWorkflow: () => (/* reexport safe */ _QSequentialWorkflow__WEBPACK_IMPORTED_MODULE_0__["default"])
/* harmony export */ });
/* harmony import */ var _QSequentialWorkflow__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./QSequentialWorkflow */ "./src/component/QSequentialWorkflow.tsx");


})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=q-sequential-workflow.bundle.js.map