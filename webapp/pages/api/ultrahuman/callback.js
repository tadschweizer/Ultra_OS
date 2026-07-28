import { handleConnectorCallback } from '../../../lib/connectorOAuth';

export default async function handler(req, res) {
  return handleConnectorCallback('ultrahuman', req, res);
}
