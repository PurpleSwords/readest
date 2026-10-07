import { READEST_WEB_BASE_URL } from '@/services/constants';
import { getRuntimeConfig, getServerRuntimeConfig } from '@/services/runtimeConfig';

// Resolve at call time so a prebuilt image uses the deployment's public URL
// on both the server and the browser, rather than a build-time constant.
export const getShareWebBaseUrl = (): string =>
  (
    getRuntimeConfig()?.apiBaseUrl ||
    getServerRuntimeConfig().apiBaseUrl ||
    READEST_WEB_BASE_URL
  ).replace(/\/+$/, '');

export const getShareBaseUrl = (): string => `${getShareWebBaseUrl()}/s`;

export const buildShareUrl = (token: string): string => `${getShareBaseUrl()}/${token}`;
