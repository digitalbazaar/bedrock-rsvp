/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock';
import path from 'path';
import {fileURLToPath} from 'url';

const {dirname} = path;
const __dirname = dirname(fileURLToPath(import.meta.url));
config.validation.schema.paths.push(path.join(__dirname, '..', 'schemas'));

const cfg = config.rsvp = {};

// ttl represents to total lifetime of an RSVP, from the time it is created
// to the time a response is received. Default: 5 minutes.
cfg.ttl = 300000,

// these optional values are used to uniquely identify a specific Bedrock worker
// running in a virtual environment such as Kubernetes
cfg.virtualHostname = null;
cfg.virtualPort = null;
