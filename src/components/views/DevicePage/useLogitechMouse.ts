import { fetchMouse } from '../../../api/logitechMouse';
import { usePolledDevice } from './usePolledDevice';

/** The mouse's onboard memory, polled, plus `change` to send a write (see usePolledDevice). */
export const useLogitechMouse = () => usePolledDevice(fetchMouse, 'devices.logitechMouse.failed');
