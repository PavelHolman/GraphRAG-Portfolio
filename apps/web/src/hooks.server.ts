// Forced: Cloudflare's native Temporal rollout was reverted (research/temporal-support).
import { installImplementation } from 'temporal-polyfill/shim';
installImplementation();
