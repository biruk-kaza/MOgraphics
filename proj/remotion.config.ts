import {Config} from '@remotion/cli/config';

// Render configuration (kept here so CI and local renders are identical)
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
