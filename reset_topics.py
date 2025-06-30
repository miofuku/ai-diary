#!/usr/bin/env python3
"""
Reset and regenerate topics from scratch using the improved system
This will:
1. Backup existing topic files
2. Remove topics.json and topic_graph.json
3. Re-extract topics from all entries using the improved algorithm
"""

import os
import json
import shutil
from datetime import datetime

def backup_existing_files():
    """Backup existing topic files before deletion"""
    backup_dir = f"data/backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(backup_dir, exist_ok=True)
    
    files_to_backup = ['data/topics.json', 'data/topic_graph.json']
    backed_up = []
    
    for file_path in files_to_backup:
        if os.path.exists(file_path):
            backup_path = os.path.join(backup_dir, os.path.basename(file_path))
            shutil.copy2(file_path, backup_path)
            backed_up.append(file_path)
            print(f"✅ Backed up {file_path} to {backup_path}")
    
    return backup_dir, backed_up

def reset_topic_files():
    """Remove existing topic files to force regeneration"""
    files_to_remove = ['data/topics.json', 'data/topic_graph.json']
    removed = []
    
    for file_path in files_to_remove:
        if os.path.exists(file_path):
            os.remove(file_path)
            removed.append(file_path)
            print(f"🗑️  Removed {file_path}")
    
    return removed

def count_entries():
    """Count entries in entries.json"""
    try:
        with open('data/entries.json', 'r', encoding='utf-8') as f:
            entries = json.load(f)
        return len(entries)
    except Exception as e:
        print(f"❌ Error reading entries.json: {e}")
        return 0

def main():
    print("=== Topic Reset and Regeneration ===\n")
    
    # Check if entries.json exists
    if not os.path.exists('data/entries.json'):
        print("❌ Error: data/entries.json not found!")
        print("This script requires your diary entries to regenerate topics.")
        return
    
    entry_count = count_entries()
    print(f"📖 Found {entry_count} diary entries in entries.json")
    
    if entry_count == 0:
        print("❌ No entries found. Cannot regenerate topics.")
        return
    
    # Backup existing files
    print("\n1. Backing up existing topic files...")
    backup_dir, backed_up = backup_existing_files()
    
    if backed_up:
        print(f"📁 Backup created in: {backup_dir}")
    else:
        print("ℹ️  No existing topic files to backup")
    
    # Remove existing topic files
    print("\n2. Removing existing topic files...")
    removed = reset_topic_files()
    
    if not removed:
        print("ℹ️  No topic files to remove")
    
    # Instructions for regeneration
    print("\n3. Next steps:")
    print("   To regenerate topics with the improved system:")
    print("   a) Start the server: python3 server.py")
    print("   b) Call the extract-topics endpoint:")
    print("      curl -X POST http://localhost:3001/api/extract-topics")
    print("   c) Or use the web interface to trigger topic extraction")
    
    print("\n✅ Reset complete!")
    print(f"📊 Ready to regenerate topics from {entry_count} entries")
    print("🎯 The new topics will be much more granular and organized!")

if __name__ == "__main__":
    main()
