$(() => {
  // jQuery onReady callback
  let app = KitBuildApp.instance();
});

CDM = {};
CDM.option = {};

class KitBuildApp {
  constructor() {
    this.kbui = KitBuildUI.instance(KitBuildApp.canvasId);
    let canvas = this.kbui.canvases.get(KitBuildApp.canvasId);
    canvas.addToolbarTool(KitBuildToolbar.UNDO_REDO, { priority: 3 });
    canvas.addToolbarTool(KitBuildToolbar.CAMERA, { priority: 4 });
    canvas.addToolbarTool(KitBuildToolbar.UTILITY, {
      priority: 5,
      trash: false,
    });
    canvas.addToolbarTool(KitBuildToolbar.LAYOUT, { stack: "right" });
    canvas.toolbar.render();

    canvas.addCanvasTool(KitBuildCanvasTool.CENTROID);

    this.canvas = canvas;
    this.runtime = Core.instance().runtime();
    this.config = Core.instance().config();

    // Enable tooltip
    $('[data-bs-toggle="tooltip"]').tooltip({ html: true });

    this.handleEvent();
    this.handleRefresh();
  }

  static instance() {
    KitBuildApp.inst = new KitBuildApp();
    return KitBuildApp.inst;
  }

  handleEvent() {

    let exportDialog = UI.modal("#concept-map-export-dialog", {
      hideElement: ".bt-cancel",
    });

    let importDialog = UI.modal("#concept-map-import-dialog", {
      hideElement: ".bt-cancel",
    });

    let feedbackDialog = UI.modal("#feedback-dialog", {
      hideElement: ".bt-close",
      backdrop: false,
      draggable: true,
      dragHandle: ".drag-handle",
      width: 375,
      onShow: () => {
        $("#feedback-dialog")
          .off("click")
          .on("click", ".bt-modify", (e) => {
            $(".app-navbar .bt-clear-feedback").trigger("click");
            feedbackDialog.hide();
            feedbackModeDialog.hide();
          });
      },
    });
    feedbackDialog.setCompare = (
      compare,
      level = Analyzer.MATCH | Analyzer.EXCESS
    ) => {
      feedbackDialog.compare = compare;
      // console.log(compare, level);
      let content = "";
      if (compare.match.length && level & Analyzer.MATCH) {
        content += `<div class="d-flex align-items-center"><i class="bi bi-check-circle-fill text-success fs-1 mx-3"></i> `;
        content += `<span>You have <strong class="text-success fs-bold">${compare.match.length} matching</strong> propositions.</span></div>`;
      }
      if (compare.excess.length && level & Analyzer.EXCESS) {
        content += `<div class="d-flex align-items-center"><i class="bi bi-exclamation-triangle-fill text-primary fs-1 mx-3"></i> `;
        content += `<span>You have <strong class="text-primary fs-bold">${compare.excess.length} excessive</strong> propositions.</span></div>`;
      }
      if (compare.miss.length && level != Analyzer.NONE) {
        content += `<div class="d-flex align-items-center"><i class="bi bi-exclamation-triangle-fill text-danger fs-1 mx-3"></i> `;
        content += `<span>You have <strong class="text-danger fs-bold">${compare.miss.length} missing</strong> propositions.</span></div>`;
      }

      if (compare.excess.length == 0 && compare.miss.length == 0) {
        content = `<div class="d-flex align-items-center"><i class="bi bi-check-circle-fill text-success fs-1 mx-3"></i> `;
        content += `<span><span class="text-success">Great!</span><br>All the propositions are <strong class="text-success fs-bold">matching</strong>.</span></div>`;
      }

      $("#feedback-dialog .feedback-content").html(content);
      return feedbackDialog;
    };

    let feedbackModeDialog = UI.modal("#feedback-mode-dialog", {
      backdrop: false,
      width: 300,
      onShow: () => {
        $("#feedback-mode-dialog").css('top', '4em').css('right', '1em');
        $("#feedback-mode-dialog")
          .off("click")
          .on("click", ".bt-modify", (e) => {
            $(".app-navbar .bt-clear-feedback").trigger("click");
            feedbackDialog.hide();
            feedbackModeDialog.hide();
          });
      }
    });

    /**
     * Open Kit
     * */

    // $(".app-navbar").on("click", ".bt-open-kit", async () => {
    //   let data = await api.openKit();
    //   if (data === undefined) {
    //     UI.warning('Kit open was cancelled.').show();
    //     return;
    //   }
    //   this.openKit(data).then((conceptMap, kit) => {
    //     importDialog.hide();
    //     this.conceptMap = conceptMap;
    //     this.kit = kit;
    //     // TODO: Apply kit options.
    //   }).catch((err) => {
    //     console.error(err);
    //     UI.errorDialog(err).show();
    //   });
    // });

        /**
     *
     * Export
     * 
     **/

    $(".app-navbar .bt-export").on("click", (e) => {

      if (!this.conceptMap) return;
      if (!this.kit) return;

      // console.log(this.conceptMap);
      // remove visual styles and unselect before saving...
      this.canvas.cy.elements().removeClass('select').unselect();
      let lmap = {};
      lmap.canvas = KitBuildUI.buildConceptMapData(this.canvas);
      lmap = KitBuildApp.cleanConceptMapData(lmap);
      delete this.kit.canvas.conceptMap
      this.kit = KitBuildApp.cleanConceptMapData(this.kit);
      // console.log(this.conceptMap, this.kit, lmap);
      $("#concept-map-export-dialog .encoded-data").val(
        `conceptMap=${Core.compress(this.conceptMap)}\r\nkit=${Core.compress(this.kit)}\r\nlmap=${Core.compress(lmap)}\r\n`
      );
      exportDialog.show();
    });

    $("#concept-map-export-dialog").on("click", ".bt-clipboard", (e) => {
      navigator.clipboard.writeText(
        $("#concept-map-export-dialog .encoded-data").val().trim()
      );
      $(e.currentTarget).html(
        '<i class="bi bi-clipboard"></i> Data has been copied to Clipboard!'
      );
      setTimeout(() => {
        $(e.currentTarget).html(
          '<i class="bi bi-clipboard"></i> Copy to Clipboard'
        );
      }, 3000);
    });

    /**
     *  
     * Import
     *
     **/  

    $(".app-navbar .bt-import").on("click", (e) => {
      importDialog.show();
    });

    $("#concept-map-import-dialog").on("click", ".bt-paste", async (e) => {
      let encoded = await navigator.clipboard.readText();
      $('#concept-map-import-dialog .encoded-data').val(encoded);
    });

    $('#concept-map-import-dialog').on("click", ".bt-decode", async (e) => {
      let data = $('#concept-map-import-dialog .encoded-data').val().trim();
      data = KitBuildApp.parseIni(data);
      if (!data.conceptMap || !data.kit) {
        UI.errorDialog('Invalid concept map and/or kit.').show();
        return;
      }
      let conceptMap = Core.decompress(data.conceptMap.replaceAll('"',''));
      if (data === undefined) {
        this.showConceptMap(conceptMap);
        return;
      }
      
      let kit = Core.decompress(data.kit.replaceAll('"',''));
      kit.canvas.conceptMap = conceptMap.canvas;
      // console.warn(kit);

      let lmap = data.lmap ? Core.decompress(data.lmap.replaceAll('"','')) : {
        canvas: {},
        map: {}
      };
      lmap.canvas.conceptMap = conceptMap.canvas;

      let cyData = KitBuildUI.composeKitMap(data.lmap ? lmap.canvas : kit.canvas);
      this.canvas.cy.elements().remove();
      this.canvas.cy.add(cyData);
      this.canvas.applyElementStyle()
      this.canvas.toolbar.tools.get(KitBuildToolbar.CAMERA).fit(null, {duration: 0})
      KitBuildUI.showBackgroundImage(this.canvas);
      CDM.option = kit.map.options;
      importDialog.hide();
      this.conceptMap = conceptMap;
      this.kit = kit;
    });

    /**
     * Save Load Learner Map
     * */

    $(".app-navbar").on("click", ".bt-save", async () => {

      if (!this.conceptMap) return;
      if (!this.kit) return;
      
      if (feedbackDialog.learnerMapEdgesData)
        $(".app-navbar .bt-clear-feedback").trigger("click");

      delete this.kit.canvas.conceptMap;
      this.kit = KitBuildApp.cleanConceptMapData(this.kit);

      let lmap = {
        map: {}
      };
      lmap.canvas = KitBuildUI.buildConceptMapData(this.canvas);
      lmap = KitBuildApp.cleanConceptMapData(lmap);

      // console.log(this.conceptMap, this.kit, lmap);

      let result = await api.saveLearnerMap(this.conceptMap, this.kit, lmap);
      if (result.lmap) UI.success('Learnermap has been saved.').show();

    });

    /**
     * Reset concept map to kit
     * */

    $(".app-navbar").on("click", ".bt-reset", (e) => {

      if (feedbackDialog.learnerMapEdgesData)
        $(".app-navbar .bt-clear-feedback").trigger("click");

      if (!this.conceptMap) return;
      if (!this.kit) return;

      UI.confirm(
        "Do you want to reset this concept map as defined in the kit?"
      )
        .positive(() => {
          this.kit.canvas.conceptMap = this.conceptMap.canvas;
          KitBuildApp.parseKitMapOptions(this.kit);
          KitBuildApp.resetMapToKit(this.kit, this.canvas);
          let undoRedo = this.canvas.toolbar.tools.get(
            KitBuildToolbar.UNDO_REDO
          );
          if (undoRedo) undoRedo.clearStacks().updateStacksStateButton();
          UI.info("Concept map has been reset.").show();
        })
        .show();
    });

    /**
     *
     * Feedback
     */
    $(".app-navbar").on("click", ".bt-feedback", () => {

      if (feedbackDialog.learnerMapEdgesData)
        $(".app-navbar .bt-clear-feedback").trigger("click");

      if (!this.conceptMap) return;
      if (!this.kit) return;

      let learnerMapData = KitBuildUI.buildConceptMapData(this.canvas);
      feedbackDialog.learnerMapEdgesData = this.canvas.cy.edges().jsons();

      learnerMapData.conceptMap = this.conceptMap.canvas;
      // console.log(learnerMapData);
      // console.log(this.kit);
      KitBuildApp.parseKitMapOptions(this.kit);
      Analyzer.composePropositions(learnerMapData);
      let direction = this.conceptMap.map.direction;
      let feedbacklevel = parseInt(this.kit.parsedOptions.feedbacklevel);
      let compare = Analyzer.compare(learnerMapData, direction);
      let level = Analyzer.NONE;
      let dialogLevel = Analyzer.NONE;
      switch (feedbacklevel) {
        case 0:
        case 1:
          level = Analyzer.NONE;
          break;
        case 2:
          level = Analyzer.MATCH | Analyzer.EXCESS;
          break;
        case 3:
          level = Analyzer.MATCH | Analyzer.EXCESS | Analyzer.EXPECT;
          break;
        case 4:
          level = Analyzer.MATCH | Analyzer.EXCESS | Analyzer.MISS;
          break;
      }
      switch (feedbacklevel) {
        case 0:
          dialogLevel = Analyzer.NONE;
          break;
        case 1:
        case 2:
        case 3:
        case 4:
          dialogLevel = Analyzer.MATCH | Analyzer.EXCESS;
          break;
      }

      Analyzer.showCompareMap(compare, this.canvas.cy, direction, level);
      this.canvas.canvasTool
        .enableIndicator(false)
        .enableConnector(false)
        .clearCanvas()
        .clearIndicatorCanvas();
      if (feedbacklevel == 0) {
        UI.dialog("Feedback is not enabled for this kit.")
          .on("dismiss", () => {
            $(".app-navbar .bt-clear-feedback").trigger("click");
          })
          .show();
      } else feedbackDialog.setCompare(compare, dialogLevel).show();

      if (feedbacklevel) {
        feedbackModeDialog.show();
      }

    });
    $(".app-navbar").on("click", ".bt-clear-feedback", () => {
      if (!feedbackDialog.learnerMapEdgesData) return;
      this.canvas.cy.edges().remove();
      this.canvas.cy.add(feedbackDialog.learnerMapEdgesData);
      this.canvas.applyElementStyle();
      this.canvas.canvasTool
        .enableIndicator()
        .enableConnector()
        .clearCanvas()
        .clearIndicatorCanvas();
      feedbackDialog.learnerMapEdgesData = null;
    });

    
    /**
     * 
     * Electron API
     * 
     **/
  
  }

  // showKit(cmap, kit) {
  //   kit.conceptMap = cmap;
  //   let cyData = KitBuildUI.composeKitMap(kit);
  //   this.canvas.cy.elements().remove();
  //   this.canvas.cy.add(cyData);
  //   this.canvas.applyElementStyle()
  //   this.canvas.toolbar.tools.get(KitBuildToolbar.CAMERA).fit(null, {duration: 0})
  // }

  /**
   *
   * Handle refresh web browser
   *
   **/

  handleRefresh() {
    const urlParams = new URLSearchParams(window.location.search);
    const mapId = urlParams.get('mapid');
    // console.log(mapId, urlParams);
    let data = MAPS.get(mapId);
    // console.log(data);
    this.openKit(data).then(result => {
      // console.log(result);
      this.conceptMap = result.conceptMap;
      this.kit = result.kit;
      KitBuildApp.parseKitMapOptions(this.kit);
      // TODO: Apply kit options.
    }).catch((err) => {
      // console.error(err);
      UI.error(err).show();
    });
  }

  openKit(data) {
    return new Promise((resolve, reject) => {
      try {
        // console.log(data);
        if (data === undefined) reject('Invalid data.');

        data = KitBuildApp.parseIni(data);
        // console.log(data);

        if (!data.conceptMap) reject('Invalid concept map.');
        if (!data.kit) reject('Invalid kit.');

        let conceptMap = Core.decompress(data.conceptMap.replaceAll('"',''));
        if (data === undefined) {
          this.showConceptMap(conceptMap);
          return;
        }
        
        let kit = Core.decompress(data.kit.replaceAll('"',''));
        kit.canvas.conceptMap = conceptMap.canvas;
        // console.warn(kit);
  
        let lmap = data.lmap ? Core.decompress(data.lmap.replaceAll('"','')) : {
          canvas: {},
          map: {}
        };
        lmap.canvas.conceptMap = conceptMap.canvas;
  
        let cyData = KitBuildUI.composeKitMap(data.lmap ? lmap.canvas : kit.canvas);
        this.canvas.cy.elements().remove();
        this.canvas.cy.add(cyData);
        this.canvas.applyElementStyle()
        this.canvas.toolbar.tools.get(KitBuildToolbar.CAMERA).fit(null, {duration: 0})
        KitBuildUI.showBackgroundImage(this.canvas);
        CDM.option = kit.map.options;
        // console.warn(kit);
        resolve({conceptMap: conceptMap, kit: kit});
      } catch(e) {
        // console.error(e);
        // UI.errorDialog("Invalid kit.").show();
        reject(e);
      }
    });
  }

}

KitBuildApp.canvasId = "recompose-canvas";

/**
 *
 * Helpers
 * 
 **/

KitBuildApp.parseIni = (data) => {
  var regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  };
  var value = {};
  var lines = data.split(/[\r\n]+/);
  var section = null;
  lines.forEach(function(line){
    if(regex.comment.test(line)){
      return;
    }else if(regex.param.test(line)){
      var match = line.match(regex.param);
      if(section){
        value[section][match[1]] = match[2];
      }else{
        value[match[1]] = match[2];
      }
    }else if(regex.section.test(line)){
      var match = line.match(regex.section);
      value[match[1]] = {};
      section = match[1];
    }else if(line.length == 0 && section){
      section = null;
    };
  });
  return value;
}

KitBuildApp.parseKitMapOptions = (kitMap) => {
  if (!kitMap) return;
  kitMap.parsedOptions = KitBuildApp.parseOptions(kitMap.map.options, {
    feedbacklevel: 2,
    fullfeedback: 1,
    modification: 1,
    readcontent: 1,
    saveload: 1,
    reset: 1,
    feedbacksave: 1,
    countfb: 1,
    countsubmit: 1,
    log: 0,
  });
};

KitBuildApp.resetMapToKit = (kitMap, canvas) => {
  return new Promise((resolve, reject) => {
    // console.log(kitMap, canvas);
    let cyData = KitBuildUI.composeKitMap(kitMap.canvas);
    canvas.cy.elements().remove();
    canvas.cy.add(cyData);
    canvas.applyElementStyle();
    KitBuildUI.showBackgroundImage(canvas);
    if (kitMap.map.layout == "random") {
      canvas.cy
        .elements()
        .layout({
          name: "fcose",
          animationDuration: 0,
          fit: false,
          stop: () => {
            canvas.toolbar.tools
              .get(KitBuildToolbar.CAMERA)
              .center(null, { duration: 0 });
            resolve(true);
          },
        })
        .run();
    } else {
      canvas.toolbar.tools
        .get(KitBuildToolbar.CAMERA)
        .fit(null, { duration: 0 });
      resolve(true);
    }
    return;
  });
};

KitBuildApp.parseOptions = (optionJsonString, defaultValueIfNull) => {
  if (optionJsonString === null) return defaultValueIfNull;
  let option,
    defopt = defaultValueIfNull;
  try {
    if(typeof optionJsonString == "string")
      option = Object.assign({}, defopt, JSON.parse(optionJsonString));
    else option = Object.assign({}, defopt, optionJsonString);
    option.feedbacklevel = option.feedbacklevel
      ? parseInt(option.feedbacklevel)
      : defopt.feedbacklevel;
  } catch (error) {
    UI.error(error).show();
  }
  return option;
};

KitBuildApp.enableNavbarButton = (enabled = true) => {
  $("#recompose-readcontent button").prop("disabled", !enabled);
  $("#recompose-saveload button").prop("disabled", !enabled);
  $("#recompose-reset button").prop("disabled", !enabled);
  $("#recompose-feedbacklevel button").prop("disabled", !enabled);
  $(".bt-submit").prop("disabled", !enabled);
  $(".bt-open-kit").prop("disabled", !enabled);
  KitBuildApp.inst.canvas.toolbar.tools.forEach((tool) => {
    tool.enable(enabled);
  });
};

KitBuildApp.cleanConceptMapData = (conceptMap) => {
  if (!conceptMap.canvas) {
    console.warn('Invalid concept map to clean. No canvas.');
    return conceptMap;
  }  
  conceptMap.canvas.concepts.forEach(c => {
    let d = JSON.parse(c.data);
    delete d.image;
    c.data = JSON.stringify(d);
  });
  conceptMap.canvas.links.forEach(l => {
    let d = JSON.parse(l.data);
    delete d.image;
    l.data = JSON.stringify(d);
  });
  return conceptMap;
}