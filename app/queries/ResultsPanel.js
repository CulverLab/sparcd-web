'use client'

/** @module queries/ResultsPanel */

import * as React from 'react';
import { DataGrid, useGridApiRef } from '@mui/x-data-grid';
import { useTheme } from '@mui/material/styles';

import PropTypes from 'prop-types';

import { UserSettingsContext } from '../serverInfo';

/**
 * Generates a panel for displaying the query results based upon different tabs
 * @function
 * @param {object} results The results of the performed query
 * @param {string} tabName The unique identifier of the tab to generate the panel for
 * @returns {object} The panel UI to render
 */ 
export default function ResultsPanel({results, tabName}) {
  const theme = useTheme();
  const userSettings = React.useContext(UserSettingsContext);  // User display settings
  const apiRef = useGridApiRef(); // TODO: Auto size columns of grids using this api

  // Perform processing heavy assignments
  const { curTitles, curData, keys, columnGroupings } = React.useMemo(() => {
    // If we're not generating a panel with columns
    if (results.columns[tabName] === undefined) {
      return {curTitles:null, curData:null, keys:null, columnFGrouping:null};
    }

    // Generate a DataGrid to display the results
    let colTitles = results.columns[tabName];
    let colData = results[tabName];
    let curData = colData;
    let columnGroupings = undefined;

    // Check for column modifications
    if (results.columnsMods[tabName] !== undefined) {
      const colModInfo = results.columnsMods[tabName];

      // Create a copy so that the original is unmodified
      colTitles = structuredClone(colTitles);

      // First level of processing modifiers
      for (const oneMod of colModInfo) {
        // Location information display specifics.
        switch (oneMod['type']) {
          case 'hasLocations':
              {
                let displayCoordSystem = 'LATLON';
                if (userSettings['coordinatesDisplay']) {
                  displayCoordSystem = userSettings['coordinatesDisplay'];
                }
                const sourceKey = oneMod[displayCoordSystem];
                const targetKey = oneMod['target'];

                // TODO: Change this to not delete but to create a new object with what we want
                // Remove all other possible column targets from the tiles
                for (const oneKey of Object.keys(oneMod)) {
                  const unwanted = oneMod[oneKey]
                  if (unwanted && colTitles[unwanted] !== undefined && unwanted !== sourceKey) {
                    delete colTitles[unwanted];
                  }
                }

                // TODO: Change this to not delete but to keep what we want new object
                // Get the information from the source and rename it to the target
                const oldInfo = colTitles[sourceKey];
                delete colTitles[sourceKey];
                if (targetKey !== null) {
                  colTitles[targetKey] = oldInfo;
                } else {
                  for (const oneKey of Object.keys(oldInfo)) {
                    colTitles[oneKey] = oldInfo[oneKey];
                  }
                }
              }
              break;
        }
      }

      // Second level of processing modifiers
      for (const oneMod of colModInfo) {
        switch (oneMod['type']) {
          case 'hasElevation':
              {
                let displayMeasure = 'meters';
                if (userSettings['measurementFormat']) {
                  displayMeasure = userSettings['measurementFormat'];
                }
                const newKey = oneMod[displayMeasure];
                const targetKey = oneMod['target'];
                const parentKey = oneMod['parent'];

                let modData = colTitles;
                if (parentKey) {
                  modData = colTitles[parentKey];
                }

                // Get the information from the source and rename it to the target
                if (newKey !== targetKey) {
                  const oldInfo = modData[targetKey];
                  delete modData[targetKey];
                  modData[newKey] = oldInfo;
                }
              }
              break;

            case 'date':
              {
                let dateFormat = 'ISO';
                let timeFormat = '24s'
                if (userSettings['dateFormat']) {
                  dateFormat = userSettings['dateFormat'];
                }
                if (userSettings['timeFormat']) {
                  timeFormat = userSettings['timeFormat'];
                }

                // If the date format is ISO we don't have anything to do
                if (dateFormat === 'ISO') {
                  break;
                }

                // Update the titles
                const sourceKey = oneMod['source'];
                const targetKey = oneMod['target'];
                const parentKey = oneMod['parent'];

                let modData = colTitles;
                if (parentKey) {
                  modData = colTitles[parentKey];
                }

                // If the time and date haven't changed from when the query was generated,
                // use what was returned
                if (dateFormat === oneMod['settingsDate'] && timeFormat === oneMod['settingsTime']) {
                  const oldInfo = modData[sourceKey];
                  delete modData[sourceKey];
                  modData['dateDefault'] = oldInfo;
                } else {
                  // We need to synthesize the date and time
                  if (sourceKey !== targetKey) {
                    const oldInfo = modData[sourceKey];
                    delete modData[sourceKey];
                    modData[targetKey] = oldInfo;
                  }

                  const dateKey = 'date' + dateFormat;
                  const timeKey = 'time' + timeFormat;

                  curData = curData.map((row) => {let rowAdd = {}; rowAdd[targetKey] = row[dateKey] + ' ' + row[timeKey];return {...rowAdd, ...row};});
                }
              }
              break;
        }
      }
    }

    let keys = Object.keys(colTitles);
    let curTitles = keys.map((name, idx) => {return {field:name, headerName:colTitles[name]}});

    if (keys.find((item) => item === 'id') === undefined) {
      curData = curData.map((row, rowIdx) => {return {id:rowIdx, ...row}});
    }

    // Check if we have column groupings and regenerate/update variables if we do
    if (keys.find((item) => typeof(colTitles[item]) === 'object' && !Array.isArray(colTitles[item])) != undefined) {
      let newKeys = [];
      let newTitles = [];
      columnGroupings = [];
      for (const curKey in colTitles) {
        if (typeof(colTitles[curKey]) === 'object' && !Array.isArray(colTitles[curKey])) {
          const curGroup = colTitles[curKey];
          const curKeys = Object.keys(curGroup);
          // TODO: Change this to filter first and then map
          columnGroupings.push({groupId:curGroup['title'],
                                children:curKeys.map((curKey) => curKey !== 'title' && {field:curKey})
                                          .filter((child) => child !== false)
                               });
          newKeys = [...newKeys, ...(curKeys.map((curKey) => curKey !== 'title' && curGroup[curKey])
                                            .filter((item) => item !== false))
                    ];
          newTitles = [...newTitles, ...(curKeys.map((curKey) => curKey !== 'title' && {field:curKey, headerName:curGroup[curKey]})
                                                .filter((item) => item !== false))
                      ];
        } else {
          // Don't add to groupings
          //columnGroupings.push({groupId:colTitles[curKey],children:[{field:curKey}]});
          newKeys.push(curKey);
          newTitles.push({field:curKey, headerName:colTitles[curKey]});
        }
      }

      keys = newKeys;
      curTitles = newTitles;
    }

    return {curTitles, curData, keys, columnGroupings}

  }, [results, tabName]);

  // Generate a textarea to display the results if we aren't generating a data grid
  if (results.columns[tabName] === undefined) {
    return (
        <textarea id={'query-results-'+tabName} readOnly wrap="off"
          style={{resize:"none", fontFamily:'monospace', fontSize:'small', fontWeight:'lighter', 
                  position:'absolute', left:0, top:0, right:0, bottom:0, padding:'5px 5px 10px 5px'}}
          value={results[tabName]}
        />
    );
  }

  return (
    <DataGrid columns={curTitles} rows={curData} disableRowSelectionOnClick 
              autosizeOptions={{
                  columns: keys,
                  includeOutliers: true,
                  includeHeaders: true,
                  outliersFactor: 1,
                  expand: true,
                }}
              columnGroupingModel={columnGroupings}
    />
  );
}

ResultsPanel.propTypes = {
  tabName: PropTypes.string.isRequired,
  results: PropTypes.shape({
    columns:    PropTypes.objectOf(
                  PropTypes.oneOfType([
                    PropTypes.objectOf(PropTypes.string),  // normal column map
                    PropTypes.object,                      // grouped columns
                  ])
                ).isRequired,
    columsMods: PropTypes.objectOf(
                  PropTypes.arrayOf(
                    PropTypes.shape({
                      type:         PropTypes.string.isRequired,
                      target:       PropTypes.string,
                      parent:       PropTypes.string,
                      // hasLocations
                      LATLON:       PropTypes.string,
                      // hasElevation
                      meters:       PropTypes.string,
                      feet:         PropTypes.string,
                      // date
                      source:       PropTypes.string,
                      settingsDate: PropTypes.string,
                      settingsTime: PropTypes.string,
                    })
                  )
                ).isRequired,
    tabs: PropTypes.shape({
      order: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    resultsCount: PropTypes.number,
    downloads:    PropTypes.objectOf(PropTypes.string),
  }).isRequired,
};
