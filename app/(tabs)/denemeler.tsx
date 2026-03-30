import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

export default function Denemeler() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Denemeler</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  text: { fontSize: 20, fontWeight: '700', color: COLORS.text },
});
