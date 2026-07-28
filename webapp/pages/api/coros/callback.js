import { handleConnectorCallback } from '../../../lib/connectorOAuth';

export default async function handler(req, res) {
  return handleConnectorCallback('coros', req, res);
}
