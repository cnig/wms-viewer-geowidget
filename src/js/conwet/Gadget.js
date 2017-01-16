/*
 *     Copyright (c) 2013 CoNWeT Lab., Universidad Politécnica de Madrid
 *     Copyright (c) 2013 IGN - Instituto Geográfico Nacional
 *     Centro Nacional de Información Geográfica
 *     http://www.ign.es/
 *
 *     This file is part of the GeoWidgets Project,
 *
 *     http://conwet.fi.upm.es/geowidgets
 *
 *     Licensed under the GNU General Public License, Version 3.0 (the 
 *     "License"); you may not use this file except in compliance with the 
 *     License.
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     under the License is distributed in the hope that it will be useful, 
 *     but on an "AS IS" BASIS, WITHOUT ANY WARRANTY OR CONDITION,
 *     either express or implied; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *  
 *     See the GNU General Public License for specific language governing
 *     permissions and limitations under the License.
 *
 *     <http://www.gnu.org/licenses/gpl.txt>.
 *
 */

use("conwet");

conwet.Gadget = Class.create({
    initialize: function() {
        this.init = true;
        
        this.poiSelectedOutput = new conwet.events.Event('poiSelectedOutput');
        this.visiblePoiListOutput = new conwet.events.Event('visiblePoiListOutput');
        this.featureInfoEvent = new conwet.events.Event('featureInfoOutput');
        this.gadgetInfoEvent = new conwet.events.Event('mapInfoOutput');
        this.legendUrl = new conwet.events.Event('legendUrlOutput');
        this.routeDescriptionOutput = new conwet.events.Event('routeDescriptionOutput');
        this.positionInfos = [];

        //this.locationSlot = new conwet.events.Slot('location_slot', this.setMarker.bind(this));
        this.poiInput = new conwet.events.Slot('poiInput', function(poi) {
            poi = JSON.parse(poi);
            if (typeof poi == 'object') {
                if (poi.hasOwnProperty("length"))
                    this.setInfoMarkers(poi);
                else
                    this.setInfoMarker(poi, false);
            }
        }.bind(this));
        //poiInputCenter; deletePoiInput; selectPoiInput
        this.poiInputCenter = new conwet.events.Slot('poiInputCenter', function(poi) {
            poi = JSON.parse(poi);
            if (typeof poi == 'object') {
                this.setInfoMarker(poi, true);
            }
        }.bind(this));
        
        this.deletePoiInput = new conwet.events.Slot('deletePoiInput', function(poi) {
            poi = JSON.parse(poi);
            if (typeof poi == 'object' && poi.id != null) {                
                this.deletePoi(poi.id);
            }
        }.bind(this));
        
        this.selectPoiInput = new conwet.events.Slot('selectPoiInput', function(poi) {
            poi = JSON.parse(poi);
            if (typeof poi == 'object' && poi.id != null) {                
                this.selectPoi(poi.id);
            }
        }.bind(this));
        
        this.addressInput = new conwet.events.Slot('addressInput', function(address){
            address = JSON.parse(address);
            this.addAddressPoi(address);
        }.bind(this));
        
        this.routeInput = new conwet.events.Slot('routeInput', function(route){
            route = JSON.parse(route);
            this.drawRoute(route);
        }.bind(this));
        
        this.routeStepInput = new conwet.events.Slot('routeStepInput', function(step){
            step = JSON.parse(step);
            this.setRouteStep(step);
        }.bind(this));

        this.wmsServiceSlot = new conwet.events.Slot('wmsInfoInput', function(service) {
            service = JSON.parse(service);
            if (typeof service == 'object') {
                if (('type' in service) && ('url' in service) && ('name' in service) && (service.url != "")) {
                    if (service.type == "WMS") {
                        this.addWmsService(service);
                    } else if (service.type == "WMSC") {
                        this.addWmscService(service);
                    } else if (service.type == "WMTS"){
                        this.addWmtsService(service);
                    }
                }
            }
        }.bind(this));

        this.gadgetInfoSlot = new conwet.events.Slot('mapInfoInput', function(state) {
            this.reacting_to_wiring_event = true;
            state = JSON.parse(state);
            try {
                this.updateState(state);
            } catch (e) {
            }
            /*if ("zoom" in state) {
             setTimeout(function() {
             this.reacting_to_wiring_event = false;
             }.bind(this), 400);
             }
             else*/
            //if (!("zoom" in state)){
            this.reacting_to_wiring_event = false;
            //}


        }.bind(this));
        //this.gadgetInfoSlot.addEvent(this.gadgetInfoEvent);

        // Attributes
        this.messageManager = new conwet.ui.MessageManager(1500);
        this.transformer = new conwet.map.ProjectionTransformer();

        this.cursorManager = new conwet.ui.CursorManager({
            'onBlur': this._disableOtherCursors.bind(this),
            'onMove': this._moveOtherCursors.bind(this)
        });

        this.reacting_to_wiring_event = true;
        this.mapManager = new conwet.map.MapManager(this, {
            onMove:this.sendState.bind(this),
            onBeforeDrag: function() {
                this.cursorManager.disableEvents();
                this._disableOtherCursors();
            }.bind(this),
            onAfterDrag: function() {
                this.cursorManager.enableEvents();
            }.bind(this),
            initialZoom: 0,
            initialCenter: {
                'lon': 0,
                'lat': 0
            },
            cursorManager: this.cursorManager
        });

    },
    sendState: function(state) {
        if (!this.reacting_to_wiring_event && !this.init) {
            /*if ("center" in state) {
                this.sendCenter(state.center.lon, state.center.lat);
            }*/
            this.gadgetInfoEvent.send(JSON.stringify(state));
        }
    },
    updateState: function(state) {
        if (!this.init) {
            if (typeof state == 'object') {
                if (('cursorCoordinates' in state) || ('focus' in state)) {
                    if ('cursorCoordinates' in state) {
                        state.cursor = this.mapManager.getPixelFromLonLat
                        (state.cursorCoordinates.longitude, state.cursorCoordinates.latitude);
                        
                        if (state.cursor) {
                            this.cursorManager.updateState(state);
                        }
                    }
                }
                if (('zoom' in state) || ('center' in state) || ("bounds" in state)) {
                    this.mapManager.updateState(state);
                }
            }
        }
    },
    addWmsService: function(wmsService) {
        this.mapManager.addWmsService(wmsService.name, wmsService.url);
    },
    addWmscService: function(wmscService) {
        this.mapManager.addWmscService(wmscService.name, wmscService.url);
    },
    addWmtsService: function(wmtsService) {
        this.mapManager.addWmtsService(wmtsService.name, wmtsService.url);
    },
    sendFeatureInfo: function(feature) {
        this.featureInfoEvent.send(JSON.stringify(feature));
    },
    sendPoisInfo: function(poisInfo) {
        this.visiblePoiListOutput.send(JSON.stringify(poisInfo));
    },
    sendPoiInfo: function(poiInfo) {
        this.poiSelectedOutput.send(JSON.stringify(poiInfo));
    },
    selectPoi: function(id) {
        this.mapManager.selectPoi(id);
    },
    deletePoi: function(id) {
        this.mapManager.deletePoi(id);
    },
    setInfoMarker: function(marker, center) {
        if (!this.init){
            this.mapManager.setEventMarker(marker, center);
        }
    },
    setInfoMarkers: function(positionInfos) {        
        if (positionInfos.length  && this.init){
            this.positionInfos = positionInfos;
        }
        
        if (positionInfos.length  && !this.init) {
            if (positionInfos[0].bbox != null)
                this.mapManager.setBox(positionInfos[0]);
            else
                this.mapManager.setEventMarkers(positionInfos);
        }
    },
    _disableOtherCursors: function() {
        this.sendState({'focus': true});
    },
    _moveOtherCursors: function(x, y) {
        var lonlat = this.mapManager.getLonLatFromPixel(x, y);
        if (!lonlat)
            return;
        this.sendState({
            cursorCoordinates: {
                longitude: lonlat.lon,
                latitude: lonlat.lat
            },
            focus: false
        });
    },
    showMessage: function(message, permanent) {
        this.messageManager.showMessage(message, conwet.ui.MessageManager.INFO, permanent);
    },
    hideMessage: function() {
        this.messageManager.hideMessage();
    },
    showError: function(message, permanent) {
        this.messageManager.showMessage(message, conwet.ui.MessageManager.ERROR, permanent);
    },
    stopInit: function() {
        this.reacting_to_wiring_event = false;
        this.init = false;
        this.setInfoMarkers(this.positionInfos);
    },
    reactingToWiring: function() {
        return this.reacting_to_wiring_event;
    },
    setReactingToWiring: function(reacting) {
        this.reacting_to_wiring_event = reacting;
    },
            
    addAddressPoi: function(addressInfo){
        var id = addressInfo.id;
        var query = addressInfo.address;
        
        var geocoder = new google.maps.Geocoder();
        var geocoderRequest = {
            address: query
        };
        /* Google has an asynchronous service */
        geocoder.geocode(geocoderRequest, function (gcResult, gcStatus) {
            if (gcStatus == google.maps.GeocoderStatus.OK) {
                var latlng = gcResult[0].geometry.location;
                var marker = {
                    id: id,
                    title:query,
                    coordinates:{
                        longitude: latlng.e,
                        latitude:  latlng.d
                    }
                };
                this.setInfoMarker(marker, false);
            }
        }.bind(this))
    },
    drawRoute: function(route){
        this.mapManager.drawRoute(route);
    },
    setRouteStep: function(step){
        this.mapManager.setRouteStep(step);
    }  

});
