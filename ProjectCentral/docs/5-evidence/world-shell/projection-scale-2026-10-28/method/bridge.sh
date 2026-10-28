#!/bin/bash
# The private, sandboxed walk-bridge: writes refused anywhere under <home>; AIKit reads a clone of its home.
S=<scratch>
exec env OI_HOME=$S/home/oi OI_EXPRESSION_HOME=$S/home/expr AIKIT_HOME=$S/home/aikit OI_CENTRAL_ROOT=<world> \
  OI_CENTRAL_CTRL_BIN=<owners>/ctrl OI_AIKIT_BIN=<owners>/aikit OI_BIN=<owners>/oi \
  OI_REPO_ROOT=<seat> OI_KERNEL_TRACE_FILE=$S/raw/trace-$2.log \
  sandbox-exec -f $S/readonly.sb <target>/debug/walk-bridge 127.0.0.1:$1
