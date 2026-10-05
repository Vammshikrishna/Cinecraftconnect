import { CachedImage } from '../common/CachedImage';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  TouchableWithoutFeedback,
} from 'react-native';
import { Icon } from '../common/Icon';

interface NetworkListModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  users: Array<{ id: string; name: string; craft: string; avatar: string }>;
  navigation: any;
}

export const NetworkListModal: React.FC<NetworkListModalProps> = ({
  visible,
  onClose,
  title,
  users,
  navigation,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.handleBar} />
              <View style={styles.headerRow}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={users}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => {
                      onClose();
                      navigation.navigate('PublicProfile', {
                        creatorName: item.name,
                        craft: item.craft,
                      });
                    }}
                  >
                    <CachedImage uri={item.avatar} style={styles.avatar} />
                    <View style={styles.userMeta}>
                      <Text style={styles.userName}>{item.name}</Text>
                      <Text style={styles.userCraft}>{item.craft}</Text>
                    </View>
                    <View style={styles.viewBtn}>
                      <Text style={styles.viewBtnText}>View →</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 17,
    fontWeight: '900',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  userMeta: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#0D0D0D',
    fontSize: 13.5,
    fontWeight: '800',
  },
  userCraft: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  viewBtn: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewBtnText: {
    color: '#0D0D0D',
    fontSize: 11.5,
    fontWeight: '700',
  },
});

export default NetworkListModal;
