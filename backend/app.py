#!/usr/bin/env python3
import os

import aws_cdk as cdk

from backend.backend_stack import BackendStack


app = cdk.App()
BackendStack(
    app,
    "BackendStack",
)

app.synth()
