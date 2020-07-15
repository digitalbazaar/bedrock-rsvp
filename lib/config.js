/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock';

const cfg = config.rsvp = {};

// these optional values are used to uniquely identify a specific Bedrock worker
// running in a virtual environment such as Kubernetes
cfg.virtualHostname = null;
cfg.virtualPort = null;
