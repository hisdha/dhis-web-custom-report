'use strict';

/* App Module */

var customReport = angular.module('customReport',
        ['ui.bootstrap', 
         'ngRoute', 
         'ngCookies',
         'ngSanitize',
         'ngMessages',
         'customReportServices',
         'customReportFilters',
         'customReportDirectives',
         'd2Directives',
         'd2Filters',
         'd2Services',
         'd2Controllers',
         'angularLocalStorage',
         'ui.select',
         'ui.select2',
         'pascalprecht.translate'])
              
.value('DHIS2URL', '../../../api')

.config(function($httpProvider, $routeProvider, $translateProvider) {    
            
    $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common['X-Requested-With'];
    
    $routeProvider.when('/report', {
        templateUrl:'components/report/home.html',
        controller: 'reportController'
    }).when('/reportRate', {
        templateUrl:'components/report-rate/home.html',
        controller: 'reportRateController'
    }).otherwise({
        redirectTo : '/report'
    });  
    
    $translateProvider.preferredLanguage('en');
    $translateProvider.useSanitizeValueStrategy('escaped');
    $translateProvider.useLoader('i18nLoader');    
})

.run(function($rootScope){    
    $rootScope.maxOptionSize = 1000;
});
