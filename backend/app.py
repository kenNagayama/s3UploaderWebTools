#!/usr/bin/env python3
import os

import aws_cdk as cdk

from backend.backend_stack import BackendStack
from backend.frontend_stack import FrontendStack

app = cdk.App()
BackendStack(
    app,
    "BackendStack",
)

FrontendStack(
    app,
    "FrontendStack",
)

app.synth()
