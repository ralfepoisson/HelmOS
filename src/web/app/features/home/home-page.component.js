(function () {
  'use strict';

  angular
    .module('helmosApp.features.home')
    .component('homePage', {
      controller: HomePageController,
      templateUrl: 'app/features/home/home-page.template.html'
    });

  HomePageController.$inject = ['SiteContentService'];

  function HomePageController(SiteContentService) {
    var $ctrl = this;

    $ctrl.$onInit = function () {
      $ctrl.content = SiteContentService.getLandingPageContent();
    };
  }
})();
