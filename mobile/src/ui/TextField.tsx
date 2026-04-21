import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme/colors';

type Props = TextInputProps & {
  label: string;
  error?: string;
};

export function TextField({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.text,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', marginLeft: 4 },
});
