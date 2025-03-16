import { Linking, Platform, Share } from 'react-native';

interface ShareOptions {
  title: string;
  message: string;
  url?: string;
}

interface InviteOptions {
  groupId: number;
  groupName: string;
  recipientPhone?: string;
  platform?: 'whatsapp' | 'sms' | 'email' | 'other';
}

// Your app's deep link or universal link prefix
const APP_LINK_PREFIX = 'https://tontine-app.com';

export const SharingService = {
  /**
   * Share content using the native share dialog
   */
  shareContent: async (options: ShareOptions): Promise<boolean> => {
    try {
      const result = await Share.share({
        title: options.title,
        message: options.message,
        url: options.url
      });
      
      if (result.action === Share.sharedAction) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sharing content:', error);
      return false;
    }
  },
  
  /**
   * Generate a deep link for group invitation
   */
  generateInviteLink: (groupId: number): string => {
    return `${APP_LINK_PREFIX}/invite?group=${groupId}`;
  },
  
  /**
   * Send invitation via WhatsApp
   */
  inviteViaWhatsApp: async (options: InviteOptions): Promise<boolean> => {
    try {
      // Format phone number (remove spaces, ensure it starts with '+')
      let formattedNumber = options.recipientPhone?.replace(/\s+/g, '') || '';
      if (formattedNumber && !formattedNumber.startsWith('+')) {
        formattedNumber = '+' + formattedNumber;
      }
      
      // Create invitation message
      const inviteLink = SharingService.generateInviteLink(options.groupId);
      const message = `You have been invited to join the "${options.groupName}" tontine group in the Tontine App. Download the app and sign up to participate: ${inviteLink}`;
      
      // Open WhatsApp with the message
      const whatsappUrl = `whatsapp://send?${formattedNumber ? `phone=${formattedNumber}&` : ''}text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return true;
      } else {
        console.log('WhatsApp not installed');
        return false;
      }
    } catch (error) {
      console.error('Error inviting via WhatsApp:', error);
      return false;
    }
  },
  
  /**
   * Send invitation via SMS
   */
  inviteViaSMS: async (options: InviteOptions): Promise<boolean> => {
    try {
      const inviteLink = SharingService.generateInviteLink(options.groupId);
      const message = `Join my "${options.groupName}" tontine group! Download the app: ${inviteLink}`;
      
      let smsUrl = `sms:${options.recipientPhone || ''}`;
      
      // iOS and Android handle SMS links differently
      if (Platform.OS === 'ios') {
        smsUrl += `&body=${encodeURIComponent(message)}`;
      } else {
        smsUrl += `?body=${encodeURIComponent(message)}`;
      }
      
      const canOpen = await Linking.canOpenURL(smsUrl);
      if (canOpen) {
        await Linking.openURL(smsUrl);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error inviting via SMS:', error);
      return false;
    }
  },
  
  /**
   * Send invitation via Email
   */
  inviteViaEmail: async (options: InviteOptions, email?: string): Promise<boolean> => {
    try {
      const inviteLink = SharingService.generateInviteLink(options.groupId);
      const subject = `Join my Tontine Group: ${options.groupName}`;
      const body = `I'd like to invite you to join my "${options.groupName}" tontine group in the Tontine App. Download the app and sign up using this link: ${inviteLink}`;
      
      let emailUrl = `mailto:${email || ''}`;
      emailUrl += `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error inviting via Email:', error);
      return false;
    }
  },
  
  /**
   * Open a general share dialog for group invitation
   */
  shareGroupInvite: async (options: InviteOptions): Promise<boolean> => {
    try {
      const inviteLink = SharingService.generateInviteLink(options.groupId);
      
      return await SharingService.shareContent({
        title: `Join my Tontine Group: ${options.groupName}`,
        message: `I'd like to invite you to join my "${options.groupName}" tontine group in the Tontine App. Download and join using this link!`,
        url: inviteLink
      });
    } catch (error) {
      console.error('Error sharing group invite:', error);
      return false;
    }
  }
};