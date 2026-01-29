#!/usr/bin/env python3
"""
Registry Validator Script
Validates that all paths in registry.json point to actual files
Exit codes:
  0 = All paths valid
  1 = Missing files found
  2 = Registry parse error
"""

import json
import os
import sys
from pathlib import Path

def main():
    # Find registry file
    repo_root = Path(__file__).parent.parent.parent
    registry_file = repo_root / "registry.json"
    
    if not registry_file.exists():
        print(f"❌ Registry file not found: {registry_file}")
        sys.exit(2)
    
    # Load registry
    try:
        with open(registry_file) as f:
            registry = json.load(f)
        print("✅ Registry file is valid JSON")
    except json.JSONDecodeError as e:
        print(f"❌ Registry file is not valid JSON: {e}")
        sys.exit(2)
    
    # Validate paths
    print("\nValidating component paths...")
    
    total = 0
    missing = 0
    missing_files = []
    
    for category, items in registry.get('components', {}).items():
        if isinstance(items, list):
            for item in items:
                if 'path' in item:
                    total += 1
                    file_path = repo_root / item['path']
                    if not file_path.exists():
                        missing += 1
                        missing_files.append({
                            'id': item.get('id', 'unknown'),
                            'name': item.get('name', 'unknown'),
                            'path': item['path'],
                            'category': category
                        })
                        print(f"✗ Missing: {item.get('id')} -> {item['path']}")
    
    # Print summary
    print(f"\n{'='*60}")
    print("Validation Summary")
    print(f"{'='*60}")
    print(f"Total paths checked:    {total}")
    print(f"Valid paths:            {total - missing}")
    print(f"Missing paths:          {missing}")
    
    if missing > 0:
        print(f"\n❌ Registry validation failed!")
        print(f"\nMissing files:")
        for f in missing_files:
            print(f"  - {f['category']}/{f['id']}: {f['path']}")
        sys.exit(1)
    else:
        print(f"\n✅ All registry paths are valid!")
        sys.exit(0)

if __name__ == "__main__":
    main()
