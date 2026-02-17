"""
Advanced NFL Player Props Model - Complete Pipeline Runner
Runs all steps in sequence: collect → features → train → predict
"""

import subprocess
import sys
import os


def run_step(script_name, description):
    """
    Run a Python script and handle errors
    """
    print("\n" + "=" * 80)
    print(f"STEP: {description}")
    print("=" * 80)

    try:
        result = subprocess.run(
            [sys.executable, script_name],
            check=True,
            capture_output=False
        )
        print(f"\n✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n✗ {description} failed with error code {e.returncode}")
        return False


def main():
    print("=" * 80)
    print("ADVANCED NFL PLAYER PROPS MODEL - FULL PIPELINE")
    print("=" * 80)
    print("\nThis will run all steps:")
    print("1. Data collection")
    print("2. Feature engineering")
    print("3. Model training")
    print("4. Prediction generation")
    print("\nEstimated time: 15-30 minutes (first run)")

    choice = input("\nContinue? (y/n): ").strip().lower()
    if choice != 'y':
        print("Aborted.")
        return

    # Step 1: Collect Data
    if not run_step('collect_data.py', 'Data Collection'):
        print("\n✗ Pipeline failed at data collection")
        return

    # Step 2: Engineer Features
    if not run_step('build_features.py', 'Feature Engineering'):
        print("\n✗ Pipeline failed at feature engineering")
        return

    # Step 3: Train Models
    if not run_step('train_models.py', 'Model Training'):
        print("\n✗ Pipeline failed at model training")
        return

    # Step 4: Generate Predictions
    if not run_step('predict_props.py', 'Prediction Generation'):
        print("\n✗ Pipeline failed at prediction generation")
        return

    print("\n" + "=" * 80)
    print("PIPELINE COMPLETE!")
    print("=" * 80)
    print("\n✓ All steps completed successfully")
    print("✓ Predictions saved to: ../src/nfl_player_prop_predictions.json")
    print("\nYour React app will now use the new advanced predictions!")


if __name__ == "__main__":
    main()
