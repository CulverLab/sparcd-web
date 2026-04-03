/** @module components/ContextProviders */

import { ThemeProvider } from "@mui/material/styles";

import PropTypes from 'prop-types';

import { AddMessageContext, BaseURLContext, CollectionsInfoContext, DisableIdleCheckFuncContext, LocationsInfoContext, MobileDeviceContext,
          NarrowWindowContext, SandboxInfoContext, SizeContext, SpeciesInfoContext, SpeciesOtherNamesContext, TokenContext, TokenExpiredFuncContext,
          UserMessageContext, UserNameContext, UserSettingsContext } from '../serverInfo';
import defaultTheme from '../Theme';

/**
 * Provides for all contexts
 * @function
 * @param {React.ReactNode} children The child components
 * @param {object} values The values for the providers
 * @param {object} theme The theme to provide to the children
 * @returns {object} Returns the children wrapped in all the providers
 */
export default function ContextProviders({ children, values, theme=defaultTheme }) {
  const {
    addMessage, collectionInfo, handleDisableIdleCheck, locationInfo,
    mobileDevice, isNarrow, sandboxInfo, sizes, speciesInfo,
    speciesOtherInfo, lastToken, onTokenExpired, userMessages,
    userSettings, serverURL,
  } = values;

  // The order of these providers is, currently, not important since there are no
  // dependencies between providers
  return (
    <ThemeProvider theme={theme}>
    <DisableIdleCheckFuncContext.Provider value={handleDisableIdleCheck}>
    <TokenExpiredFuncContext.Provider value={onTokenExpired}>
    <MobileDeviceContext.Provider value={mobileDevice}>
    <NarrowWindowContext.Provider value={isNarrow}>
    <SizeContext.Provider value={sizes}>
    <UserNameContext.Provider value={userSettings?.name}>
    <UserSettingsContext.Provider value={userSettings?.settings}>
    <BaseURLContext.Provider value={serverURL}>
    <TokenContext.Provider value={lastToken}>
    <AddMessageContext.Provider value={addMessage}>
    <CollectionsInfoContext.Provider value={collectionInfo}>
    <LocationsInfoContext.Provider value={locationInfo}>
    <SandboxInfoContext.Provider value={sandboxInfo}>
    <SpeciesInfoContext.Provider value={speciesInfo}>
    <SpeciesOtherNamesContext.Provider value={speciesOtherInfo}>
    <UserMessageContext.Provider value={userMessages}>
      {children}
    </UserMessageContext.Provider>
    </SpeciesOtherNamesContext.Provider>
    </SpeciesInfoContext.Provider>
    </SandboxInfoContext.Provider>
    </LocationsInfoContext.Provider>
    </CollectionsInfoContext.Provider>
    </AddMessageContext.Provider>
    </TokenContext.Provider>
    </BaseURLContext.Provider>
    </UserSettingsContext.Provider>
    </UserNameContext.Provider>
    </SizeContext.Provider>
    </NarrowWindowContext.Provider>
    </MobileDeviceContext.Provider>
    </TokenExpiredFuncContext.Provider>
    </DisableIdleCheckFuncContext.Provider>
    </ThemeProvider>
  );
}

ContextProviders.propTypes = {
  children: PropTypes.node.isRequired,
  values: PropTypes.shape({
    addMessage: PropTypes.func.isRequired,
    collectionInfo: PropTypes.array,
    handleDisableIdleCheck: PropTypes.func.isRequired,
    isNarrow: PropTypes.bool,
    lastToken: PropTypes.string,
    locationInfo: PropTypes.array,
    mobileDevice: PropTypes.bool,
    onTokenExpired: PropTypes.func.isRequired,
    sandboxInfo: PropTypes.object,
    serverURL: PropTypes.string.isRequired,
    sizes: PropTypes.object.isRequired,
    speciesInfo: PropTypes.array,
    speciesOtherInfo: PropTypes.array,
    userMessages: PropTypes.object.isRequired,
    userSettings: PropTypes.object.isRequired,
  }).isRequired,
};
