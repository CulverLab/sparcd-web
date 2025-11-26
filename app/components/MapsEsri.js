'use client'

/** @module components/MapsEsri */

import * as React from 'react';

import '@arcgis/map-components/dist/components/arcgis-legend';
import '@arcgis/map-components/dist/components/arcgis-map';
import '@arcgis/map-components/dist/components/arcgis-zoom';
import Collection from "@arcgis/core/core/Collection";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Point from "@arcgis/core/geometry/Point";
import ValuePicker from "@arcgis/core/widgets/ValuePicker";
import ValuePickerCombobox from "@arcgis/core/widgets/ValuePicker/ValuePickerCombobox";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

import { LocationsInfoContext, UserSettingsContext } from '../serverInfo';
import { meters2feet } from '../utils';

/**
 * Returns the UI for displaying an ESRI map
 * @function
 * @param {object} enter An X, Y value with the center of the area of interest
 * @param {string} mapName The ESRI name of the map to display
 * @param {array} mapChoices An array of available map display choice objects
 * @param {function} onChange Handler for when the user changes the map to display
 * @param {int} top The top position of the map element
 * @param {int} width The width of the map element (assumed to start at left:0)
 * @param {int} height The height of the map element
 */
export default function MapsEsri({center, mapName, mapChoices, onChange, top, width, height}) {
  const locationItems = React.useContext(LocationsInfoContext);
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const [layerCollection, setLayerCollection] = React.useState(null); // The array of layers to display
  const [generatedMap, setGeneratedMap] = React.useState(false);

  /**
   * Handle converting the locations for use with the maps
   * @function
   * @param {object} Array of locations
   * @param {string} measurementFormat A measurement format of 'feet' or 'meters'
   */
  function configureLocations(locationItems, measurementFormat) {
    if (measurementFormat === 'meters') {
      return locationItems;
    }

    let newLocations = JSON.parse(JSON.stringify(locationItems));

    return newLocations.map((item) => {
        item.elevationProperty = Math.trunc(meters2feet(item.elevationProperty)) + 'ft';
        return item;}
    );
  }

  const displayLocations = React.useMemo(() => configureLocations(locationItems, userSettings['measurementFormat']), [locationItems, userSettings['measurementFormat']]);

  let popupFields = userSettings['coordinatesDisplay'] === 'LATLON' ?
                [ {
                    fieldName: 'nameProperty',
                    label: 'Name',
                    visible: true,
                  },
                  {
                    fieldName: 'latProperty',
                    label: 'Latitude',
                    visible: true,
                  },
                  {
                    fieldName: 'lngProperty',
                    label: 'Longitude',
                    visible: true,
                  },
                  {
                    fieldName: 'elevationProperty',
                    label: 'Elevation',
                    visible: true,
                  }
                ]
              : [ {
                  fieldName: 'nameProperty',
                  label: 'Name',
                  visible: true,
                },
                {
                  fieldName: 'utm_code',
                  label: 'UTM Code',
                  visible: true,
                },
                {
                  fieldName: 'utm_x',
                  label: 'UTM X',
                  visible: true,
                },
                {
                  fieldName: 'utm_y',
                  label: 'UTM Y',
                  visible: true,
                },
                {
                  fieldName: 'elevationProperty',
                  label: 'Elevation',
                  visible: true,
                }
              ]


  /**
   * Generates the locations layer for display
   * @function
   */
  const getLocationLayer = React.useCallback(() => {
    let curCollection = layerCollection || [];
    if (!layerCollection) {
      let startIdx = 0;
      while (startIdx * 100 < displayLocations.length) {
        let features = displayLocations.slice(startIdx * 100,(startIdx+1)*100).map((item, idx) => 
          new Graphic({
                  geometry: new Point({x:parseFloat(item.lngProperty),
                                       y:parseFloat(item.latProperty), 
                                       z:parseFloat(item.elevationProperty)
                                     }),
                  symbol: {
                    type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
                    color: "blue",
                    size: 8,
                    outline: { // autocasts as new SimpleLineSymbol()
                      width: 0.5,
                      color: "darkblue"
                    }
                  },
                  attributes: {...item, ...{objectId: idx}},
                  popupTemplate: {
                    title: item.idProperty,
                    content: [{
                        type: 'fields',
                        fieldInfos: popupFields
                      }]
                  }
                })
        );

        let layer = new GraphicsLayer({graphics: features});

        curCollection.push(layer);
        startIdx++;
      }
    }
    setLayerCollection(curCollection);

    return curCollection;
  }, [layerCollection, locationItems])

  // When the map div is available, setup the map
  React.useLayoutEffect(() => {
    const mapEl = document.getElementById('viewDiv');
    if (mapEl && !generatedMap) {
      setGeneratedMap(true);
      const layers = getLocationLayer();                      // Displayed layers
      const map = new Map({basemap:mapName, layers:layers});  // Create the map of desired ty[e]

      // Get the value of the selected map for initial choice on map chooser
      const curMapName = mapChoices.find((item) => item.config.mapName === mapName);
      const curMapValue = curMapName ? curMapName.value : mapChoices[0].value;

      // Get the names of the maps and create the display control
      const collectionNames = mapChoices.map((item) => {return {label:item.name, value:item.value};});
      const valuePicker = new ValuePicker({
        visibleElements: {
          nextButton: false,
          playButton: false,
          previousButton: false
        },
        component: {
          type: "combobox", // autocasts to ValuePickerCombobox
          placeholder: "Map Type",
          items: collectionNames
        },
        values: [curMapValue],
        visible: true
      });

      // Add a watcher for when the map choice changes
      reactiveUtils.watch(
        () => valuePicker.values,
        (values) => onChange(values[0])
      );

      // Create the view onto the map
      const view = new MapView({
        map: map,
        container: 'viewDiv',
        center: center,
        zoom: 7
      });

      // Add the map picker to the display
      view.ui.add(valuePicker, "top-right");

    }
  } ,[center, getLocationLayer, mapChoices, mapName, onChange]);

  /**
   * Handles the popover for locations
   * @function
   * @param {object} event The event data to check
   */
  function onMouseOverPopup(event) { 
    // See: https://support.esri.com/en-us/knowledge-base/how-to-display-pop-ups-using-a-mouse-hover-in-arcgis-ap-000024297
    /*
         view.hitTest(event).then(function (response) { 
           if (response.results.length) { 
             var graphic = response.results.filter(function (result) { 
               // check if the graphic belongs to the layer of interest 
               return result.graphic.layer === featureLayer; 
             })[0].graphic; 
             view.popup.open({ 
               location: graphic.geometry.centroid, 
               features: [graphic] 
             }); 
           } else { 
             view.popup.close(); 
           } 
         }); 
       }); 
     }); 
    */
  }

  // Return the UI
  return (
    <React.Fragment>
      <div id="viewDiv" style={{width:width+'px', maxWidth:width+'px', height:height+'px', maxHeight:height+'px'}} >
      </div>
    </React.Fragment>
  );
}
