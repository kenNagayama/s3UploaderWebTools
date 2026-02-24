import pytest
import importlib.util

spec = importlib.util.spec_from_file_location("transform_handler", "lambda/transform_handler.py")
transform_handler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transform_handler)

get_nominal_diameter = transform_handler.get_nominal_diameter
clean_excel_formula = transform_handler.clean_excel_formula

def test_clean_excel_formula():
    assert clean_excel_formula('="123"') == '123'
    assert clean_excel_formula('123') == '123'
    assert clean_excel_formula('="abc"') == 'abc'

def test_get_nominal_diameter():
    assert get_nominal_diameter('X') == "15.49"
    assert get_nominal_diameter('Y') == "15.49"
    assert get_nominal_diameter(' Z ') == "15.49"
    assert get_nominal_diameter('') == "12.34"
    assert get_nominal_diameter('B') == "12.34"
    assert get_nominal_diameter(' C ') == "12.34"
    assert get_nominal_diameter('UNKNOWN') == "15.49"
