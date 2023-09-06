/* global dhis2, angular, selection, i18n_ajax_login_failed, _ */

dhis2.util.namespace('dhis2.customReport');
dhis2.util.namespace('dhis2.rd');

// whether current user has any organisation units
dhis2.customReport.emptyOrganisationUnits = false;

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline, data will be stored locally';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';
var i18n_need_to_sync_notification = 'There is data stored locally, please upload to server';
var i18n_sync_now = 'Upload';
var i18n_uploading_data_notification = 'Uploading locally stored data to the server';

var optionSetsInPromise = [];
var attributesInPromise = [];
var batchSize = 50;

dhis2.customReport.store = null;
dhis2.rd.metaDataCached = dhis2.rd.metaDataCached || false;
dhis2.customReport.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.customReport.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}

dhis2.customReport.store = new dhis2.storage.Store({
    name: 'dhis2cr',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['dataSets', 'periodTypes', 'categoryCombos', 'dataElementGroups', 'categoryOptionGroupSets', 'organisationUnitGroupSets','optionSets']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt
 * 2. Load meta-data (and notify ouwt)
 *
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();
});

$(document).bind('dhis2.online', function(event, loggedIn)
{
    if (loggedIn)
    {
        var OfflineDataValueService = angular.element('body').injector().get('OfflineDataValueService');

        OfflineDataValueService.hasLocalData().then(function(localData){
            if(localData){
                var message = i18n_need_to_sync_notification + ' <button id="sync_button" type="button">' + i18n_sync_now + '</button>';

                setHeaderMessage(message);

                $('#sync_button').bind('click', uploadLocalData);
            }
            else{
                if (dhis2.customReport.emptyOrganisationUnits) {
                    setHeaderMessage(i18n_no_orgunits);
                }
                else {
                    setHeaderDelayMessage(i18n_online_notification);
                }
            }
        });


        if (dhis2.customReport.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderDelayMessage(i18n_online_notification);
        }
    }
    else
    {
        var form = [
            '<form style="display:inline;">',
            '<label for="username">Username</label>',
            '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<label for="password">Password</label>',
            '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<button id="login_button" type="button">Login</button>',
            '</form>'
        ].join('');

        setHeaderMessage(form);
        ajax_login();
    }
});

$(document).bind('dhis2.offline', function()
{
    if (dhis2.customReport.emptyOrganisationUnits) {
        setHeaderMessage(i18n_no_orgunits);
    }
    else {
        setHeaderMessage(i18n_offline_notification);
    }
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

function downloadMetaData()
{
    console.log('Loading required meta-data');

    return dhis2.customReport.store.open()
        .then( getSystemSetting )
        .then( getPeriodTypes )

        .then( getMetaCategoryCombos )
        .then( filterMissingCategoryCombos )
        .then( getCategoryCombos )

        .then( getMetaDataElementGroups )
        .then( filterMissingDataElementGroups )
        .then( getDataElementGroups )

        .then( getMetaDataSets )
        .then( filterMissingDataSets )
        .then( getDataSets )

        .then( getMetaCategoryOptionGroupSets )
        .then( filterMissingCategoryOptionGroupSets )
        .then( getCategoryOptionGroupSets )

        .then( getMetaOrganisationUnitGroupSets )
        .then( filterMissingOrganisationUnitGroupSets )
        .then( getOrganisationUnitGroupSets )

        //Option Sets are added to contain the labels in the dataSet report.
        .then( getMetaOptionSets)
        .then( filterMissingOptionSets)
        .then( getOptionSets);

}

function getSystemSetting(){
    if(localStorage['SYSTEM_SETTING']){
       return;
    }
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', '../../../api/systemSettings', 'key=keyGoogleMapsApiKey&key=keyMapzenSearchApiKey&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms', 'sessionStorage', dhis2.customReport.store);
}

function getPeriodTypes(){
    return dhis2.metadata.getMetaObjects('periodTypes', 'periodTypes', '../../../api/periodTypes', 'fields=name,frequencyOrder', 'idb', dhis2.customReport.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', '../../../api/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.customReport.store, objs);
}

function getCategoryCombos( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'categoryCombos', 'categoryCombos', '../../../api/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categoryOptionCombos[id,displayName],categories[id,displayName,code,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code]]', 'idb', dhis2.customReport.store);
}

function getMetaDataElementGroups(){
    return dhis2.metadata.getMetaObjectIds('dataElementGroups', '../../../api/dataElementGroups.json', 'paging=false&fields=id,version');
}

function filterMissingDataElementGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElementGroups', dhis2.customReport.store, objs);
}

function getDataElementGroups( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'dataElementGroups', 'dataElementGroups', '../../../api/dataElementGroups.json', 'paging=false&fields=id,displayName,code,dataElements,attributeValues[value,attribute[id,name,valueType,code]] ','idb', dhis2.customReport.store, dhis2.metadata.processObject);
}

function getMetaDataSets(){
    return dhis2.metadata.getMetaObjectIds('dataSets', '../../../api/dataSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataSets', dhis2.customReport.store, objs);
}

function getDataSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'dataSets', 'dataSets', '../../../api/dataSets.json', 'paging=false&fields=id,displayName,version,timelyDays,expiryDays,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],sections[id,displayName,description,sortOrder,code,dataElements,greyedFields[dimensionItem],indicators[id,displayName,indicatorType,numerator,denominator,attributeValues[value,attribute[id,name,valueType,code]]]],dataSetElements[id,dataElement[id,code,name,displayFormName,description,attributeValues[value,attribute[id,name,valueType,code]],description,formName,valueType,categoryCombo[id,categoryOptionCombos[id,name,code]]]]', 'idb', dhis2.customReport.store, dhis2.metadata.processObject);
}

function getMetaCategoryOptionGroupSets(){
    return dhis2.metadata.getMetaObjectIds('categoryOptionGroupSets', '../../../api/categoryOptionGroupSets.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryOptionGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryOptionGroupSets', dhis2.customReport.store, objs);
}

function getCategoryOptionGroupSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'categoryOptionGroupSets', 'categoryOptionGroupSets', '../../../api/categoryOptionGroupSets.json', 'paging=false&fields=id,displayName,version,attributeValues[value,attribute[id,name,valueType,code]],categoryOptionGroups[id,displayName,categoryOptions[id,displayName]]', 'idb', dhis2.customReport.store, dhis2.metadata.processObject);
}

function getMetaOrganisationUnitGroupSets(){
    return dhis2.metadata.getMetaObjectIds('organisationUnitGroupSets', '../../../api/organisationUnitGroupSets.json', 'paging=false&fields=id,version');
}

function filterMissingOrganisationUnitGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('organisationUnitGroupSets', dhis2.customReport.store, objs);
}

function getOrganisationUnitGroupSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'organisationUnitGroupSets', 'organisationUnitGroupSets', '../../../api/organisationUnitGroupSets.json', 'paging=false&fields=id,displayName,version,organisationUnitGroups[id,displayName]', 'idb', dhis2.customReport.store, dhis2.metadata.processObject);
}

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', '../../../api/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.customReport.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, batchSize, 'optionSets', 'optionSets', '../../../api/optionSets.json', 'paging=false&fields=id,displayName,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code]', 'idb', dhis2.customReport.store, dhis2.metadata.processObject);
}