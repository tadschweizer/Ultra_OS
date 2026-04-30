import { ConnectorClient } from './connectorClient';

const connectorMap = {
  oura: new ConnectorClient({
    provider: 'oura',
    authUrl: 'https://cloud.oura.com/oauth/authorize',
    tokenUrl: 'https://api.oura.com/oauth/token',
    scope: 'daily heartrate sleep workout tag',
    clientId: process.env.OURA_CLIENT_ID,
    clientSecret: process.env.OURA_CLIENT_SECRET,
    redirectUri: process.env.OURA_REDIRECT_URI,
  }),
  garmin: new ConnectorClient({
    provider: 'garmin',
    authUrl: process.env.GARMIN_AUTH_URL || 'https://connect.garmin.com/oauth/authorize',
    tokenUrl: process.env.GARMIN_TOKEN_URL || 'https://connect.garmin.com/oauth/token',
    scope: process.env.GARMIN_SCOPE || 'activity',
    clientId: process.env.GARMIN_CLIENT_ID,
    clientSecret: process.env.GARMIN_CLIENT_SECRET,
    redirectUri: process.env.GARMIN_REDIRECT_URI,
  }),
  coros: new ConnectorClient({
    provider: 'coros',
    authUrl: process.env.COROS_AUTH_URL || 'https://open.coros.com/oauth/authorize',
    tokenUrl: process.env.COROS_TOKEN_URL || 'https://open.coros.com/oauth/token',
    scope: process.env.COROS_SCOPE || 'activity',
    clientId: process.env.COROS_CLIENT_ID,
    clientSecret: process.env.COROS_CLIENT_SECRET,
    redirectUri: process.env.COROS_REDIRECT_URI,
  }),
  ultrahuman: new ConnectorClient({
    provider: 'ultrahuman',
    authUrl: process.env.ULTRAHUMAN_AUTH_URL || 'https://api.ultrahuman.com/oauth/authorize',
    tokenUrl: process.env.ULTRAHUMAN_TOKEN_URL || 'https://api.ultrahuman.com/oauth/token',
    scope: process.env.ULTRAHUMAN_SCOPE || 'recovery activity sleep',
    clientId: process.env.ULTRAHUMAN_CLIENT_ID,
    clientSecret: process.env.ULTRAHUMAN_CLIENT_SECRET,
    redirectUri: process.env.ULTRAHUMAN_REDIRECT_URI,
  }),
};

export function getConnector(provider) {
  return connectorMap[provider];
}
