/* global angular */

'use strict';

var customReport = angular.module('customReport');

//Controller for settings page
customReport.controller('DiseaseGroupDetailController',
        function($scope,
                $modalInstance,
                dataValues,
                dataElements,
                diseaseGroup,
                columns,
                optionCombos) {
    
    $scope.model = {};
    $scope.model.diseaseGroup = diseaseGroup;
    $scope.model.columns = columns;
    $scope.dataValues = dataValues;
    $scope.model.filteredOptionCombos = optionCombos;
    $scope.model.dataElements = dataElements;
    $scope.close = function() {
        $modalInstance.close(  );
    };
});