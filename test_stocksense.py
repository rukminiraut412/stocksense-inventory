# -*- coding: utf-8 -*-
"""
StockSense - Team Member 3 Hardening & Verification Suite
Server must be running on http://localhost:8000
Run with: python test_stocksense.py
"""

import os
import sys

# Forward directly to test_phase3.py
script_dir = os.path.dirname(os.path.abspath(__file__))
phase3_path = os.path.join(script_dir, "test_phase3.py")

if __name__ == "__main__":
    with open(phase3_path, "r", encoding="utf-8") as f:
        code = f.read()
    exec(compile(code, phase3_path, "exec"))
