import unittest
from app import update_impact  # Zorg ervoor dat update_impact uit app.py komt

class TestImpactLogic(unittest.TestCase):

    def setUp(self):
        # Stel de initiële impact in voor elke test
        global impact
        impact = 0

    def test_update_impact(self):
        """Test of de impact correct wordt bijgewerkt"""
        update_impact("A")
        self.assertEqual(impact, 1)  # Na A zou impact 1 moeten zijn

        update_impact("B")
        self.assertEqual(impact, 0)  # Na B zou impact 0 moeten zijn

        update_impact("C")
        self.assertEqual(impact, 2)  # Na C zou impact 2 moeten zijn

        update_impact("A")
        self.assertEqual(impact, 3)  # Na opnieuw A zou impact 3 moeten zijn

if __name__ == '__main__':
    unittest.main()
