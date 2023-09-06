/* global angular */

'use strict';

var customReport = angular.module('customReport');

//Controller for settings page
customReport.controller('reportController',
        function($scope,
                $log,
                $modal,
                orderByFilter,
                PeriodService,
                MetaDataFactory,
                DataElementGroupFactory,
                DataEntryUtils,
                Analytics) { 
                    $scope.periodOffset = 0;
                    $scope.maxOptionSize = 30;
                    $scope.model = {dataSets: [],
                    reportColumn: 'PERIOD',
                    categoryCombos: [],
                    dataElementGroups: [],
                    orgUnitGroupSets: [],
                    categoryOptionGroupSets: [],
                    groupIdsByDataElement: [],
                    groupsByDataElement: [],
                    optionSets: [],
                    showDiseaseGroup: false,
                    periods: [],
                    selectedPeriods: [],
                    includeChildren: false,
                    periodTypes: [],
                    columns: [],
                    reportReady: false,
                    reportStarted: false,
                    showDimensionFilters: false,
                    showReportFilters: true,
                    showDiseaseFilters: true,
                    selectedPeriodType: null,
                    reportName: '',
                    metaDataLoaded: false,
                    valueExists: false};
                
    downloadMetaData().then(function(){
        console.log( 'Finished loading meta-data' );
        MetaDataFactory.getAll('dataSets').then(function(ds){
            $scope.model.dataSets = ds;

            MetaDataFactory.getAll('categoryOptionGroupSets').then(function( cogs ){

                $scope.model.categoryOptionGroupSets = cogs;

                MetaDataFactory.getAll('organisationUnitGroupSets').then(function( ougs ){

                    $scope.model.orgUnitGroupSets = ougs;

                    MetaDataFactory.getAll('periodTypes').then(function(pts){

                        pts = orderByFilter(pts, '-frequencyOrder').reverse();
                        $scope.model.periodTypes = pts;
                        
                        MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                            angular.forEach(ccs, function(cc){
                                $scope.model.categoryCombos[cc.id] = cc;
                            });

                            MetaDataFactory.getAll('dataElementGroups').then(function(degs){

                                angular.forEach(degs, function(deg){
                                    $scope.model.dataElementGroups[deg.id] = deg;
                                    angular.forEach(deg.dataElements, function(de){
                                        $scope.model.groupsByDataElement[de.id] = {id: deg.id, name: deg.displayName};
                                    });
                                });

                                DataElementGroupFactory.getNonControllingDataElementGroups().then(function (degs) {
                                    $scope.dataElementGroups = degs;

                                    selectionTreeSelection.setMultipleSelectionAllowed( true );
                                    selectionTree.clearSelectedOrganisationUnitsAndBuildTree();

                                    $scope.model.metaDataLoaded = true;
                                });
                                
                                 
                                //get the optionSets from indexDBand assign them to $scope.model.optionSets if it is not assigned already
                                MetaDataFactory.getAll('optionSets').then(function(opts){
                                    angular.forEach(opts, function(op){
                                        $scope.model.optionSets[op.id]=op;
                                    })
                                });
                            });
                        });
                    });
                });
            });
        });
    });
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnits', function() {
        if( angular.isObject($scope.selectedOrgUnits)){
            if( !$scope.selectedOrgUnits || $scope.selectedOrgUnits.length > 1 ){
                $scope.model.includeChildren = false;
            }
        }
    });
    
    $scope.$watch('model.selectedPeriodType', function(){
        $scope.model.periods = [];
        $scope.model.reportReady = false;
        $scope.model.reportStarted = false;
        if( angular.isObject( $scope.model.selectedPeriodType ) && $scope.model.selectedPeriodType.name ) {
            var opts = {
                periodType: $scope.model.selectedPeriodType.name,
                periodOffset: $scope.periodOffset,
                futurePeriods: 1
            };
            $scope.model.periods = PeriodService.getReportPeriods( opts );
        }
    });
    
    $scope.$watch('model.selectedDataSet', function(){
        $scope.model.dataElements = [];
        $scope.model.reportReady = false;
        $scope.model.reportStarted = false;
        $scope.model.indicators = [];
        $scope.model.columns = [];
        $scope.dataValues = {};
        $scope.model.greyedFields = [];
        if( angular.isObject( $scope.model.selectedDataSet ) ) {
            angular.forEach($scope.model.selectedDataSet.sections, function(section){
                if(section.greyedFields && section.greyedFields.length > 0){
                    $scope.model.greyedFields = $scope.model.greyedFields.concat( section.greyedFields );
                }
            });
            
            $scope.model.selectedAttributeCategoryCombo = null;     
            if( $scope.model.selectedDataSet && 
                $scope.model.selectedDataSet.categoryCombo && 
                $scope.model.selectedDataSet.categoryCombo.id ){
            
                $scope.model.selectedAttributeCategoryCombo = $scope.model.categoryCombos[$scope.model.selectedDataSet.categoryCombo.id];
            }
            
            if( $scope.model.selectedDataSet.DataSetCategory === 'Disease' ){
                $scope.model.selectedDataSet.dataElements = orderByFilter( $scope.model.selectedDataSet.dataElements, '-code').reverse();
                angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                    $scope.model.dataElements[de.id] = de;
                });
            }
            else {
                if( $scope.model.selectedDataSet.sections.length > 0 ){
                    var takenLabels = {};
                    var dataElements = [], indicators = [];
                    angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                        $scope.model.dataElements[de.id] = de;
                    });

                    angular.forEach($scope.model.selectedDataSet.sections, function(section){                    
                        
                        angular.forEach(section.dataElements, function(de){
                            var dataElement = $scope.model.dataElements[de.id];

                            if( dataElement ){
                                if(dataElement.labelDEGroup && !takenLabels[dataElement.labelDEGroup]){
                                    dataElement.displayTitle = {};
                                    dataElement.displayTitle.serialNumber = dataElement.labelDEGroup;
                                    takenLabels[dataElement.labelDEGroup]=true;
                                    var labelOptionSet = {};
                                    var keys= Object.keys($scope.model.optionSets);
                                    
                                    //find the labeling optinoSet
                                    for(var i=0; i<keys.length; i++){
                                        if($scope.model.optionSets[keys[i]].label_option_set){
                                            labelOptionSet = $scope.model.optionSets[keys[i]];
                                            break;
                                        }
                                    }
                                    
                                    //find the name of the specific option using the code.
                                    var options= labelOptionSet.options;
                                    for(var i = 0; i<options.length; i++){
                                        if(dataElement.labelDEGroup === options[i].code){
                                            dataElement.displayTitle.displayName = options[i].displayName;
                                            break;
                                        }
                                    }
                                }

                                dataElements.push( dataElement );
                            }
                        });

                        angular.forEach(section.indicators,function(indicator){
                           indicators.push( indicator );
                        });
                    });

                    $scope.model.selectedDataSet.dataElements = dataElements;
                    $scope.model.selectedDataSet.indicators = indicators;
                    $log.info('indicators: ', indicators)
                }
            }
        }
    });
    
    $scope.getPeriods = function(mode){
        if( $scope.model.selectedPeriodType.name ){
            var opts = {
                periodType: $scope.model.selectedPeriodType.name,
                periodOffset: mode === 'NXT' ? ++$scope.periodOffset: --$scope.periodOffset,
                futurePeriods: 1
            };
            $scope.model.periods = PeriodService.getReportPeriods( opts );
        }
    };
    
    function processDataValues( validOptionCombos, isDiseaseReport ) {
        $scope.model.dataElementsWithValue = [];
        $scope.dataValues = {};
        $scope.model.totalDataValues = [];
        $scope.model.totalGroupDataValues = [];
        for( var key in $scope.model.rawData ){
            var val = $scope.model.rawData[key];
            var keys = key.split('-');
            if( keys.length === 2 ){
                keys.splice(1, 0, 'total');                        
            }
            
            if( isDiseaseReport && validOptionCombos ){
                if( validOptionCombos.indexOf(keys[1]) !== -1 ){
                    if ( !$scope.dataValues[keys[0]] ){
                        $scope.dataValues[keys[0]] = {};
                    }
                    if(!$scope.dataValues[keys[0]][keys[1]]){
                        $scope.dataValues[keys[0]][keys[1]] = {};
                        $scope.dataValues[keys[0]][keys[1]]['grandTotal'] = 0;
                    }

                    $scope.dataValues[keys[0]][keys[1]][keys[2]] = val;
                    $scope.dataValues[keys[0]][keys[1]]['grandTotal'] += val;
                }
            }
            else{
                if ( !$scope.dataValues[keys[0]] ){
                    $scope.dataValues[keys[0]] = {};
                }
                
                if(!$scope.dataValues[keys[0]][keys[1]]){
                    $scope.dataValues[keys[0]][keys[1]] = {};
                    $scope.dataValues[keys[0]][keys[1]]['grandTotal'] = 0;
                }
                $scope.dataValues[keys[0]][keys[1]][keys[2]] = val;
                $scope.dataValues[keys[0]][keys[1]]['grandTotal'] += val;
            }
        }
        $scope.model.dataElementsWithValue = Object.keys( $scope.dataValues );
    }
    function getDataElementByName(dataElements,headers,row) {
        const index = headers?.findIndex((header)=>header?.name?.toLowerCase() === "data element");
        return dataElements?.find((de)=>de?.displayFormName === row[index] || de?.formName === row[index] || de?.name === row[index]);                
    }
    function getHeaderIndexByKey(headers,key='value') {
        return headers?.findIndex((header)=>header?.name?.toLowerCase() === key);               
    }
    function getRowsValueByKey(headers,rows,value, key='value') {
        const index = headers?.findIndex((header)=>header?.name?.toLowerCase() === key);
        return rows?.filter((row)=>row[index] === value);                
    }
    function getDataTotal(headers,row) {
        const index = headers?.findIndex((header)=>header?.name?.toLowerCase() === "total");
        return row[index];                
    }
    function getCategoryOptionComboIndex(headers,value) {
        return headers?.findIndex((de)=> de?.name === value);                
    }
    function getRowTotal (value){
        let grandTotal = 0;
        const keys = Object.keys(value??{});
        angular.forEach(keys,(val)=>{
            if(val?.toLocaleLowerCase() === 'grandtotal'){
                grandTotal += 0;
            }
            else{
                grandTotal += Number(value[val]??0);
            }                
        });
        return grandTotal;
    }
    function getTotals (n){
            let grandTotal = 0;
            if(Object.hasOwn(n,'total')){
                const keys = Object.keys(n['total']??{});
                
                angular.forEach(keys,(val)=>{
                    if(val !== 'grandTotal' && val){
                        grandTotal += Number(n[val]??0);
                    }
                });
                n['total']['grandTotal'] = grandTotal;
            }
            return n;
    }
    function getColumnTotal (data, index){
        return data?.reduce((acc,cur)=>{
            acc += Number(cur[index]??0);
            return acc;
        },0)
    }
    function getDataElementTotal (data,current,de,columns,headers,reportColumn) {
        const adjustedData = current;
        const idx = getHeaderIndexByKey(headers,'value')
        angular.forEach(columns,(column)=>{
            const peData = (reportColumn !== 'ORGUNIT')?getRowsValueByKey(headers,data,column,'pe'):getRowsValueByKey(headers,data,column,'ou');
            adjustedData[de]['total'][column] = getColumnTotal(peData,idx);
        })
        return adjustedData;
    }
    function mergeTwoArray (x1,x2){
        if(x2){
            var nonX2 = {};
            var x1o = Object.keys(x1??{});
            var x2o = Object.keys(x2??{});
            Object.entries(x2??{})?.forEach(([key,value])=>{
                if(!x1o.includes(key)){
                    nonX2[key] = value;
                }
            });
            x1o.forEach((m)=>{
                if(x2o.includes(m)){
                    var hv=x2[m];
                    var hmo = Object.keys(hv??{});
                    var xmo = Object.keys(x1[m]??{})
                    hmo.forEach((k)=>{
                        if(xmo.includes(k)){
                            x1[m][k]= Object.assign(x1[m][k],hv[k])
                            x1[m][k]['grandTotal'] = getRowTotal(x1[m][k]) 
                        }
                        else{
                            x1[m][k]=hv[k]
                            x1[m][k]['grandTotal'] = getRowTotal(x1[m][k]) 
                        }
                    });
                   
                }
            });
            return Object.assign({},x1,nonX2);
        }
        return x1;
    }
    function tranformValues (data,elements,column) {
        var dataValues= {};
        angular.forEach(data,(key)=>{
            angular.forEach(key?.rows,(row)=>{
                const deHead = getDataElementByName(elements , key?.headers,row);
                dataValues[deHead?.id] = {
                    total: {
                        [column]: getDataTotal(key?.headers,row)
                    }
                }
                angular.forEach(deHead?.categoryCombo.categoryOptionCombos,(coc)=>{
                    dataValues[deHead?.id][coc.id] ={
                        [column]: row[getCategoryOptionComboIndex(key?.headers,coc.name)]
                    }
                });
            });           
        });
        return dataValues;
    }

    function tranformAnalyticsValues ( data, elements,columns,reportColumn) {
        var dataValues = {};
        var headers = data?.headers;
        var rows = data?.rows;
        angular.forEach(elements,(element)=>{
            dataValues[element?.id]={
                total: {
                    grandTotal: 0
                },
                
            };
            const deData= getRowsValueByKey(headers,rows,element?.id,'dx');
            dataValues  = getDataElementTotal (deData,dataValues,element?.id,columns,headers,reportColumn);

            let grandTotal = 0;
            angular.forEach(element?.categoryCombo.categoryOptionCombos,(coc)=>{
                const cocData = getRowsValueByKey(headers,deData,coc?.id,'co');
                let total = 0;
                dataValues[element?.id][coc?.id] ={
                    grandTotal: 0
                };
                angular.forEach(columns,(column)=>{
                    const peData = (reportColumn !== 'ORGUNIT')?getRowsValueByKey(headers,cocData,column,'pe'):getRowsValueByKey(headers,cocData,column,'ou');                  
                    if(peData.length === 1){
                        total += Number(peData[0][getHeaderIndexByKey(headers,'value')]??0);
                        dataValues[element?.id][coc?.id][column] = peData[0][getHeaderIndexByKey(headers,'value')] 
                    }                     
                });
                dataValues[element?.id][coc?.id]['grandTotal']= total;
                grandTotal += total;
            });
            dataValues[element?.id]['total']['grandTotal']= grandTotal;     
        });
        return dataValues;
    }
    function processDataValuesByNewApi( validOptionCombos, isDiseaseReport ) {
        $scope.model.dataElementsWithValue = [];
        $scope.dataValues = {};
        let multiValues = {};
        $scope.model.totalDataValues = [];
        $scope.model.totalGroupDataValues = [];
        $scope.mappedValues = $scope.model.rawData;
        let curIndex = 0;
        /*let n = 0;
        let d2 = null;
        let d1 = null;
        */
        multiValues = tranformAnalyticsValues($scope.mappedValues[curIndex],$scope.model.selectedDataSet.dataElements,$scope.dimension,$scope.model.reportColumn);
        
        /*else{
            d1 = tranformValues($scope.mappedValues[curIndex],$scope.model.selectedDataSet.dataElements,$scope.dimension[curIndex]);
            angular.forEach($scope.dimension,(_col,index)=>{
                multiValues = mergeTwoArray(d1,d2);
                curIndex = index + 1;
                d1 = multiValues;
                if(curIndex <= $scope.dimension.length - 1){
                    d2 = tranformValues($scope.mappedValues[curIndex],$scope.model.selectedDataSet.dataElements,$scope.dimension[curIndex]);
                }
            });
        }*/
        $scope.dataValues = multiValues;
        $scope.model.dataElementsWithValue = Object.keys( $scope.dataValues );
    }
    function processGroupDataValues( validOptionCombos ) {
        $scope.groupDataValues = {};
        $scope.groupsWithValue = [];
        angular.forEach($scope.model.dataElementsWithValue, function(de){
            var deg = $scope.model.groupsByDataElement[de];
            if( deg ){                        
                if( !$scope.groupsWithValue[deg.id]){
                    $scope.groupsWithValue[deg.id] = {id: deg.id, name: deg.name, dataElements: []};
                }
                $scope.groupsWithValue[deg.id].dataElements.push(de);
            }

            var ocKeys = Object.keys( $scope.dataValues[de] );
            $scope.dataValues[de]['total'] = {
                'grandTotal': getTotals($scope.dataValues[de])
            };                    
            angular.forEach($scope.model.columns, function(col){
                var total = 0;
                angular.forEach(ocKeys, function(ocKey){
                    if( validOptionCombos.indexOf(ocKey) !== -1 ){
                        var val = $scope.dataValues[de][ocKey][col.id];
                        if( val ){
                            total += val;
                        }
                    }
                });
                $scope.dataValues[de]['total'][col.id] = total > 0 ? total : '';
            });

            var total = 0;
            angular.forEach(ocKeys, function(ocKey){
                if( validOptionCombos.indexOf(ocKey) !== -1 ){
                    var val = $scope.dataValues[de][ocKey]['grandTotal'];
                    if( val ){
                        total += val;
                    }
                }
            });
            $scope.dataValues[de]['total']['grandTotal'] = total > 0 ? total : '';
            var displayName = $scope.model.dataElements[de] && $scope.model.dataElements[de].displayFormName ? $scope.model.dataElements[de].displayFormName : '';
            $scope.model.totalDataValues.push({id: de, displayName: displayName, value: total});
        });
        
        if( $scope.groupsWithValue && Object.values( $scope.groupsWithValue ) && Object.values( $scope.groupsWithValue ).length > 0  ){            
            angular.forEach(Object.values( $scope.groupsWithValue ), function(gr){
                $scope.groupDataValues[gr.id] = {total: {grandTotal: 0}};
                if( gr.dataElements && gr.dataElements.length > 0 ){
                    angular.forEach($scope.selectedCategoryCombo.categoryOptionCombos, function(oc){
                        if( validOptionCombos.indexOf(oc.id) !== -1 ){
                            angular.forEach($scope.model.columns, function(col){
                                var val = 0;
                                angular.forEach(gr.dataElements, function(de){
                                    if( $scope.dataValues[de][oc.id] && $scope.dataValues[de][oc.id][col.id] ){
                                        val += $scope.dataValues[de][oc.id][col.id];
                                    }
                                });
                                if( val > 0 ){
                                    if(!$scope.groupDataValues[gr.id][oc.id]){
                                        $scope.groupDataValues[gr.id][oc.id] = {};
                                    }
                                    $scope.groupDataValues[gr.id][oc.id][col.id] = val;
                                }
                            });
                        }
                    });

                    var ocKeys = Object.keys( $scope.groupDataValues[gr.id] );
                    $scope.groupDataValues[gr.id]['total'] = {}; 
                    var grandTotal = 0;
                    angular.forEach($scope.model.columns, function(col){
                        var total = 0;
                        angular.forEach(ocKeys, function(ocKey){
                            if( validOptionCombos.indexOf(ocKey) !== -1 ){
                                var val = $scope.groupDataValues[gr.id][ocKey][col.id];
                                if( val ){
                                    total += val;
                                }
                            }
                        });
                        if( total > 0 ){
                            $scope.groupDataValues[gr.id]['total'][col.id] = total;
                            grandTotal += total;
                        }
                    });
                    if( grandTotal > 0 ){
                       $scope.groupDataValues[gr.id]['total']['grandTotal'] = grandTotal; 
                    }

                    var total = 0;
                    angular.forEach(ocKeys, function(ocKey){
                        if( ocKey === 'total' || validOptionCombos.indexOf(ocKey) !== -1 ){
                            var val = $scope.groupDataValues[gr.id][ocKey]['grandTotal'];
                            if( val ){
                                total += val;
                            }

                            var ocTotal = 0;
                            angular.forEach($scope.model.columns, function(col){
                                var v = $scope.groupDataValues[gr.id][ocKey][col.id];
                                if( v ){
                                    ocTotal += v;
                                }
                            });
                            if( ocTotal > 0 ){
                                $scope.groupDataValues[gr.id][ocKey]['grandTotal'] = ocTotal;
                            }
                        }
                    });
                    $scope.model.totalGroupDataValues.push({group: gr.id, displayName: gr.name, value: total});
                }
            });
        }
        $scope.model.totalDataValues = orderByFilter( $scope.model.totalDataValues, '-value');
        $scope.model.totalGroupDataValues = orderByFilter( $scope.model.totalGroupDataValues, '-value');
    }
    
    $scope.generateReport = function(){
        
        if( !$scope.selectedOrgUnits || $scope.selectedOrgUnits.length < 1 ){
            DataEntryUtils.notify('error', 'please_select_orgunit');
            return;
        }
        
        if( !$scope.model.selectedDataSet ){
            DataEntryUtils.notify('error', 'please_select_dataset');
            return;
        }

        if( !$scope.model.selectedPeriods || $scope.model.selectedPeriods.length < 1 ){
            DataEntryUtils.notify('error', 'please_select_period');
            return;
        }

        $scope.model.reportStarted = true;
        $scope.model.reportReady = false;
        $scope.model.showReportFilters = false;
        $scope.model.showDimensionFilters = false;
        $scope.model.columns = [];
        
        if( $scope.model.selectedDataSet.DataSetCategory === 'Disease' ){

            var additionalDimensions = [];

            angular.forEach( $scope.model.categoryOptionGroupSets, function(cogs){
                if( cogs.selectedOptions && cogs.selectedOptions.length ){
                    additionalDimensions.push("dimension=" + cogs.id + ":" + $.map(cogs.selectedOptions, function(co){return co.id;}).join(';') );
                }
            });

            angular.forEach( $scope.model.orgUnitGroupSets, function(ougs){
                if( ougs.selectedOptions && ougs.selectedOptions.length ){
                    additionalDimensions.push("dimension=" + ougs.id + ":" + $.map(ougs.selectedOptions, function(co){return co.id;}).join(';') );
                }
            });

            var dimension = [];
            var analyticsUrl = "ds=" + $scope.model.selectedDataSet.id;
            analyticsUrl += "&orgUnits=" + $.map($scope.selectedOrgUnits, function(ou){return ou.id;}).join(',');
            analyticsUrl += "&periods=" + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(',');
            
            if( $scope.model.selectedAttributeCategoryCombo && 
                $scope.model.selectedAttributeCategoryCombo.id && 
                !$scope.model.selectedAttributeCategoryCombo.isDefault ){

                angular.forEach( $scope.model.selectedAttributeCategoryCombo.categories, function(ca){
                    if( ca.selectedOptions && ca.selectedOptions.length ){
                        dimension.push("dimension=" + ca.id + ":" + $.map(ca.selectedOptions, function(co){return co.id;}).join(';') );
                    }
                });
            }

            if( $scope.model.reportColumn === 'ORGUNIT' ){            
                analyticsUrl += '&periodAsFilter=true';
                $scope.model.reportName = $scope.model.selectedDataSet.displayName + ' - ' + $.map($scope.model.selectedPeriods, function(pe){return pe.name;}).join('; '); 
                $scope.model.columns = $scope.selectedOrgUnits;
            }
            else{
                analyticsUrl += '&periodAsFilter=false';
                $scope.model.reportName = $scope.model.selectedDataSet.displayName + ' - ' + $.map($scope.selectedOrgUnits, function(ou){return ou.name;}).join('; ');
                $scope.model.columns = orderByFilter( $scope.model.selectedPeriods, '-id').reverse();
            }

            if( dimension.length > 0 ){
                analyticsUrl += '&' + dimension.join('&');
                var dimensionNames = [];
                angular.forEach( $scope.model.selectedAttributeCategoryCombo.categories, function(ca){
                    if( ca.selectedOptions && ca.selectedOptions.length ){
                        dimensionNames.push( ca.displayName + "=" + $.map(ca.selectedOptions, function(co){return co.displayName;}).join(',') );
                    }
                });
                $scope.model.reportName += ' - ' + dimensionNames.join(';');
            }

            if ( additionalDimensions.length > 0 ){
                analyticsUrl += '&' + additionalDimensions.join('&');
            }
        
            Analytics.getDiseaseReport( analyticsUrl ).then(function(data){
                $scope.model.rawData = data;
                $scope.model.reportReady = true;
                $scope.model.reportStarted = false;
                $scope.selectedCategoryCombo = $scope.model.categoryCombos[$scope.model.selectedDataSet.dataElements[0].categoryCombo.id];
                $scope.model.filteredOptionCombos = $scope.selectedCategoryCombo.categoryOptionCombos;

                if( Object.keys( data ).length === 0 ){
                    DataEntryUtils.notify('info', 'no_data_exists');
                    $scope.model.dataExists = false;
                    return;
                }
                else{
                    $scope.model.dataExists = true;
                    processDataValuesByNewApi( $.map($scope.model.filteredOptionCombos, function(oc){return oc.id;}), true );
                    processGroupDataValues( $.map($scope.model.filteredOptionCombos, function(oc){return oc.id;}), true );
                }                
            });
        }
        else{

            var additionalFilters = [];

            angular.forEach( $scope.model.categoryOptionGroupSets, function(cogs){
                if( cogs.selectedOptions && cogs.selectedOptions.length ){
                    additionalFilters.push("filter=" + cogs.id + ":" + $.map(cogs.selectedOptions, function(co){return co.id;}).join(';') );
                }
            });

            angular.forEach( $scope.model.orgUnitGroupSets, function(ougs){
                if( ougs.selectedOptions && ougs.selectedOptions.length ){
                    additionalFilters.push("filter=" + ougs.id + ":" + $.map(ougs.selectedOptions, function(co){return co.id;}).join(';') );
                }
            });

            $scope.dimension = []; 
            var filter = '';
            if( $scope.model.reportColumn === 'ORGUNIT' ){
                // New Api does not support multi organization units, use organisation Groups instead
                // dimension.push( "ou=" + $.map($scope.selectedOrgUnits, function(ou){return ou.id;}).join(',') );
                $scope.dimension = $.map($scope.selectedOrgUnits, function(ou){return ou.id;});
                filter = "filter=pe:" + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(';');
                $scope.model.columns = $scope.selectedOrgUnits;

                $scope.model.reportName = $scope.model.selectedDataSet.displayName + ' (' + $.map($scope.model.selectedPeriods, function(pe){return pe.name;}).join('; ') + ')'; 
            }
            else{
                // dimension.push("pe=" + $.map($scope.model.selectedPeriods, function(pe){return pe.id;}).join(',') );
                $scope.dimension = $.map($scope.model.selectedPeriods, function(pe){return pe.id;});
                filter = "filter=ou:" + $.map($scope.selectedOrgUnits, function(ou){return ou.id;}).join(';');
                $scope.model.columns = orderByFilter( $scope.model.selectedPeriods, '-id').reverse();

                $scope.model.reportName = $scope.model.selectedDataSet.displayName + ' (' + $.map($scope.selectedOrgUnits, function(ou){return ou.name;}).join('; ') + ')'; 
            }

            if ( additionalFilters.length > 0 ){
                filter += '&filter=' + additionalFilters.join('&');
            }

            Analytics.getReport($scope.model.selectedDataSet.id, $scope.dimension, filter, $scope.model.selectedDataSet.DataSetCategory,$scope.model.reportColumn,$scope.model.selectedDataSet.dataElements).then(function(data){
                $scope.model.rawData = data;
                $scope.model.reportReady = true;
                $scope.model.reportStarted = false;
                if( Object.keys( data??{} ).length === 0 || data.length === 0){
                    DataEntryUtils.notify('info', 'no_data_exists');
                    $scope.model.dataExists = false;
                    return;
                }
                else{
                    $scope.model.dataExists = true;
                    processDataValuesByNewApi(null, false);
                }
            }); 
        }
    };
    
    $scope.filterOptionCombos = function(){
        var selectedOptions = [], 
            ocos = [], 
            optionCombos = $scope.selectedCategoryCombo.categoryOptionCombos;
    
        if( $scope.selectedCategoryCombo && $scope.selectedCategoryCombo.categories ){
            for( var i=0; i<$scope.selectedCategoryCombo.categories.length; i++){
                if( $scope.selectedCategoryCombo.categories[i].selectedFilterOptions && $scope.selectedCategoryCombo.categories[i].selectedFilterOptions.length > 0 ){
                    selectedOptions.push( $scope.selectedCategoryCombo.categories[i].selectedFilterOptions );
                }
                else{
                    selectedOptions.push( $.map($scope.selectedCategoryCombo.categories[i].categoryOptions, function(co){return co.displayName;}) );
                }
            }
            ocos = dhis2.metadata.cartesianProduct(selectedOptions);
        }
        
        if( ocos.length === 0 ){
            $scope.model.filteredOptionCombos = $scope.selectedCategoryCombo.categoryOptionCombos;
        }
        else{
            $scope.model.filteredOptionCombos = [];
        }
        
        for( var j=0; j<ocos.length; j++){
            var optionNames = ocos[j].join(', ');
            var reverseOptionNames = ocos[j].reverse().join(', ');
            var continueLoop = true;
            for( var k=0; k<optionCombos.length && continueLoop; k++){
                if( optionNames === optionCombos[k].displayName ){
                    $scope.model.filteredOptionCombos.push( optionCombos[k] );
                    continueLoop = false;
                    break;
                }
                else if( reverseOptionNames === optionCombos[k].displayName ){
                    $scope.model.filteredOptionCombos.push( optionCombos[k] );
                    continueLoop = false;
                    break;
                }
            }
        }       
        
        processDataValuesByNewApi( $.map($scope.model.filteredOptionCombos, function(oc){return oc.id;}), true );
        // Comment out for testing purposes
        //processGroupDataValues( $.map($scope.model.filteredOptionCombos, function(oc){return oc.id;}), true );
    };
    
    $scope.showDiseaseGroupDetail = function( groupId ){
        if( groupId && $scope.groupsWithValue[groupId] && $scope.groupsWithValue[groupId].dataElements){
            var groupDataElements = [];
            angular.forEach($scope.groupsWithValue[groupId].dataElements, function(de){
                groupDataElements[de] = $scope.model.dataElements[de];
            });
            
            var modalInstance = $modal.open({
                templateUrl: 'components/report/disease-group-detail.html',
                controller: 'DiseaseGroupDetailController',
                windowClass: 'modal-window-history',
                resolve: {
                    dataValues: function(){
                        return $scope.dataValues;
                    },
                    dataElements: function(){
                        return groupDataElements;
                    },
                    diseaseGroup: function(){
                        return $scope.groupsWithValue[groupId];
                    },
                    columns: function(){
                        return $scope.model.columns;
                    },
                    optionCombos: function(){
                        return $scope.model.filteredOptionCombos;
                    }
                }
            });

            modalInstance.result.then(function () {}); 
        }
        else{
            DataEntryUtils.notify('warning', 'group_has_no_details');
            return;
        }
    };
    
    $scope.exportData = function () {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });        
        saveAs(blob, $scope.model.reportName + '.xls' );
    };
});
