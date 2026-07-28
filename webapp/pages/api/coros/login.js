import { handleConnectorLogin } from '../../../lib/connectorOAuth';

export default function handler(req, res) {
  return handleConnectorLogin('coros', req, res);
}
