import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import {
  Building2,
  Camera,
  Hash,
  Image as ImageIcon,
  Layers,
  Mail,
  Package,
  Phone,
  Share2,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSelectedModel } from '@/utils/modelStorage';
import { getConfidenceThresholds } from '@/utils/confidenceStorage';

import { ThemeToggle } from '@/components/ThemeToggle';
import { BACKEND_URL } from '@/constants/api';
import { lookupBrandSupport } from '@/constants/brandDirectory';
import { analyzePackagingWithGemini } from '@/services/geminiVision';
import { getProfileData } from '@/utils/profileStorage';
import { saveScan } from '@/utils/scanStorage';

export default function SupportBetaScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [annotatedImageFilename, setAnnotatedImageFilename] = useState<string | null>(null);
  const [annotatedImageLocalUri, setAnnotatedImageLocalUri] = useState<string | null>(null);
  const [showAnnotated, setShowAnnotated] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);

  // Defect Detection Model State
  const [defectStatus, setDefectStatus] = useState<string | null>(null);
  const [defectConfidence, setDefectConfidence] = useState<number | null>(null);
  const [defectReason, setDefectReason] = useState<string | null>(null);

  // Form State
  const [brand, setBrand] = useState('');
  const [product, setProduct] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [issueDetails, setIssueDetails] = useState('');

  // Load Profile Name from Settings on mount
  useEffect(() => {
    getProfileData().then((data) => {
      if (data.name) {
        setCustomerName(data.name);
      }
    });
  }, []);

  const handleBrandChange = (newBrandText: string) => {
    setBrand(newBrandText);
    if (newBrandText.trim().length >= 2) {
      const match = lookupBrandSupport(newBrandText, product);
      if (match) {
        if (!email || email === 'Not Found' || email.includes('@')) {
          setEmail(match.email);
        }
        if (!phone || phone === 'Not Found' || phone.startsWith('1800') || phone.startsWith('0')) {
          setPhone(match.phone);
        }
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library permissions are required to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0].uri) {
      const selectedUri = result.assets[0].uri;
      resetState();
      setImage(selectedUri);
      runVisionPipeline(selectedUri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0].uri) {
      const selectedUri = result.assets[0].uri;
      resetState();
      setImage(selectedUri);
      runVisionPipeline(selectedUri);
    }
  };

  const resetState = () => {
    setAnnotatedImageFilename(null);
    setAnnotatedImageLocalUri(null);
    setDefectStatus(null);
    setDefectConfidence(null);
    setDefectReason(null);
    setBrand('');
    setProduct('');
    setEmail('');
    setPhone('');
    setOrderNumber('');
    setIssueDetails('');
  };

  const runVisionPipeline = async (imageUri: string) => {
    setExtracting(true);

    let detectedDefectStatus = 'INTACT';
    let annotatedFilename = '';
    let confidence = 0;

    try {
      const selectedModel = await getSelectedModel().catch(() => 'best');
      const thresholds = await getConfidenceThresholds();
      const confidenceThreshold = selectedModel === 'latest' ? thresholds.latest : thresholds.best;
      const uploadUrl = `${BACKEND_URL}/upload/?model=${selectedModel}&confidence_threshold=${confidenceThreshold}`;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, imageUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        headers: { Accept: 'application/json' },
      });

      if (uploadResult.status >= 200 && uploadResult.status < 300) {
        const uploadData = JSON.parse(uploadResult.body);
        const res = uploadData.result;
        if (res) {
          detectedDefectStatus = res.status || 'INTACT';
          confidence = res.confidence || 0;
          annotatedFilename = res.annotated_image || '';

          setDefectStatus(detectedDefectStatus);
          setDefectConfidence(confidence);
          if (annotatedFilename) {
            setAnnotatedImageFilename(annotatedFilename);
            const localDest = `${FileSystem.cacheDirectory}annotated_${annotatedFilename}`;
            FileSystem.downloadAsync(`${BACKEND_URL}/uploads/${annotatedFilename}`, localDest)
              .then((dl) => setAnnotatedImageLocalUri(dl.uri))
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Backend defect inspection error:', err);
    }

    const formattedStatus = detectedDefectStatus === 'DEFECTIVE' ? 'DEFECTIVE' : 'INTACT';

    try {
      const visionResult = await analyzePackagingWithGemini(imageUri, formattedStatus);

      if (visionResult.brand) {
        handleBrandChange(visionResult.brand);
      }
      if (visionResult.product) {
        setProduct(visionResult.product);
      }
      if (visionResult.email) {
        setEmail(visionResult.email);
      }
      if (visionResult.phone) {
        setPhone(visionResult.phone);
      }
      if (visionResult.orderNumber) {
        setOrderNumber(visionResult.orderNumber);
      }

      const summaryText =
        visionResult.defectSummary ||
        (formattedStatus === 'DEFECTIVE'
          ? `Packaging inspection confirmed physical defect with ${confidence ? `${(confidence * 100).toFixed(1)}%` : 'high'} confidence. Structural damage observed on the packaging surface.`
          : 'Packaging inspection confirmed intact condition.');

      setDefectReason(summaryText);
      setIssueDetails(
        `Defect Status: ${formattedStatus}\nFindings: ${summaryText}\n\nRequesting resolution / replacement for the packaging defect.`
      );

      // Auto-save scan
      await saveScan({
        type: 'support',
        title: visionResult.product || visionResult.brand || (formattedStatus === 'DEFECTIVE' ? 'Defective Packaging' : 'Intact Package'),
        status: formattedStatus === 'DEFECTIVE' ? 'DEFECTIVE' : 'INTACT',
        confidence: confidence || 0.95,
        imageUri,
        annotatedImage: annotatedFilename || undefined,
        reason: summaryText,
        brand: visionResult.brand || undefined,
        product: visionResult.product || undefined,
      });
    } catch (err) {
      console.error('Error during image analysis:', err);
    } finally {
      setExtracting(false);
    }
  };

  const handleCallSupport = () => {
    if (!phone || phone === 'Not Found') {
      Alert.alert('No Helpline Number', 'No helpline phone number available.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call.');
    });
  };

  const getEmailContent = () => {
    const subject = `[Defect Complaint] Damaged Packaging Report - ${product || brand || 'Product'}`;
    const defectConfidenceFormatted = defectConfidence ? `${(defectConfidence * 100).toFixed(1)}%` : 'N/A';
    const statusText = defectStatus === 'DEFECTIVE' ? 'DEFECTIVE (Packaging Damage Confirmed)' : defectStatus || 'DEFECTIVE';

    const bodyText =
      `Dear ${brand || 'Customer Support'} Team,\n\n` +
      `I am writing to formally report a defective packaging issue observed upon inspection of the product.\n\n` +
      `--- PRODUCT & ORDER DETAILS ---\n` +
      `• Brand / Manufacturer: ${brand || 'N/A'}\n` +
      `• Product Name: ${product || 'N/A'}\n` +
      `• Order / Batch / Lot #: ${orderNumber || 'N/A'}\n` +
      `• Customer Name: ${customerName || 'Valued Customer'}\n\n` +
      `--- AI DEFECT INSPECTION REPORT ---\n` +
      `• Defect Status: ${statusText}\n` +
      `• Model Confidence: ${defectConfidenceFormatted}\n` +
      `• Defect Summary: ${defectReason || 'Packaging surface damage detected by inspection model.'}\n\n` +
      `--- COMPLAINT / ISSUE DETAILS ---\n` +
      `${issueDetails || 'Packaging defect and physical damage observed during inspection.'}\n\n` +
      `Please provide instructions on replacement or compensation at your earliest convenience.\n\n` +
      `Sincerely,\n` +
      `${customerName || 'Valued Customer'}`;

    return { subject, bodyText };
  };

  const handleLaunchEmailDraft = async () => {
    if (!image) {
      Alert.alert('No Image', 'Please capture or upload a packaging photo first.');
      return;
    }

    if (extracting) {
      Alert.alert('Analyzing', 'Please wait while the AI analyzes your image.');
      return;
    }

    setDraftingEmail(true);

    try {
      if (!customerName) {
        const profile = await getProfileData();
        if (profile.name) setCustomerName(profile.name);
      }

      const { subject, bodyText } = getEmailContent();
      const recipient = email && email !== 'Not Found' ? email : '';
      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      const gmailAppUrl = `googlegmail:///co?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      try {
        const canOpenGmail = await Linking.canOpenURL(gmailAppUrl);
        if (canOpenGmail) {
          await Linking.openURL(gmailAppUrl);
        } else {
          await Linking.openURL(mailtoUrl);
        }
      } catch {
        await Linking.openURL(mailtoUrl);
      }
    } catch (err) {
      console.error('Error opening email app:', err);
      Alert.alert('Error', 'Unable to launch mail app.');
    } finally {
      setDraftingEmail(false);
    }
  };

  const handleShareProof = async () => {
    const targetUri = annotatedImageLocalUri || image;
    if (!targetUri) {
      Alert.alert('No Image', 'Please capture or upload a packaging image first.');
      return;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        dialogTitle: 'Share Annotated Packaging Defect Report',
        mimeType: 'image/jpeg',
      });
    } else {
      Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
    }
  };

  const currentPreviewUri =
    showAnnotated && annotatedImageFilename
      ? `${BACKEND_URL}/uploads/${annotatedImageFilename}`
      : image;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center py-5">
          <View>
            <Text className="text-3xl font-black text-black dark:text-white tracking-tight">
              AI Support
            </Text>
            <Text className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-0.5">
              Brand detection & complaint drafting
            </Text>
          </View>
          <ThemeToggle />
        </View>

        {/* Card 1: Packaging Image */}
        <View className="mb-6 bg-white dark:bg-[#111114] p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-black text-black dark:text-white">
              1. Packaging Photo
            </Text>
            {defectStatus ? (
              <View
                className={`flex-row items-center gap-1.5 px-3 py-1 rounded-full ${
                  defectStatus === 'DEFECTIVE'
                    ? 'bg-[#FF2D55]/10 border border-[#FF2D55]/20'
                    : 'bg-zinc-100 dark:bg-zinc-800'
                }`}
              >
                {defectStatus === 'DEFECTIVE' ? (
                  <ShieldAlert size={13} color="#FF2D55" />
                ) : (
                  <ShieldCheck size={13} color="#71717A" />
                )}
                <Text
                  className={`text-xs font-black ${
                    defectStatus === 'DEFECTIVE'
                      ? 'text-[#FF2D55]'
                      : 'text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  {defectStatus === 'DEFECTIVE' ? 'Defect Detected' : 'Intact'}{' '}
                  {defectConfidence ? `(${(defectConfidence * 100).toFixed(0)}%)` : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {image ? (
            <View className="relative rounded-2xl overflow-hidden mb-4 border border-zinc-200 dark:border-zinc-800">
              <Image
                source={{ uri: currentPreviewUri || image }}
                className="w-full h-56"
                resizeMode="cover"
              />

              {/* Extraction / Annotation Overlay */}
              {extracting && (
                <View className="absolute inset-0 bg-black/80 items-center justify-center p-4">
                  <ActivityIndicator size="large" color="#FF2D55" />
                  <Text className="text-white text-sm font-bold mt-3 text-center">
                    AI Scanning Packaging...
                  </Text>
                  <Text className="text-zinc-400 text-xs mt-1 text-center">
                    Detecting brand, support contacts & defect analysis
                  </Text>
                </View>
              )}

              {/* Toggle original / annotated view */}
              {!extracting && annotatedImageFilename ? (
                <View className="absolute bottom-2.5 right-2.5">
                  <Pressable
                    onPress={() => setShowAnnotated(!showAnnotated)}
                    className="bg-black/80 px-3 py-1.5 rounded-full flex-row items-center gap-1.5 border border-white/20 active:opacity-80"
                  >
                    <Layers size={13} color="#FF2D55" />
                    <Text className="text-white text-xs font-semibold">
                      {showAnnotated ? 'Annotated' : 'Original'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="flex-row gap-3">
            <Pressable
              onPress={takePhoto}
              className="flex-1 bg-[#FF2D55] py-3.5 rounded-2xl flex-row justify-center items-center gap-2 shadow-sm shadow-[#FF2D55]/20 active:opacity-90"
            >
              <Camera size={18} color="#FFFFFF" />
              <Text className="text-white font-bold text-sm">Camera</Text>
            </Pressable>
            <Pressable
              onPress={pickImage}
              className="flex-1 bg-zinc-50 dark:bg-zinc-900 py-3.5 rounded-2xl flex-row justify-center items-center gap-2 border border-zinc-200 dark:border-zinc-800 active:opacity-90"
            >
              <ImageIcon size={18} color="#FF2D55" />
              <Text className="text-black dark:text-white font-bold text-sm">Gallery</Text>
            </Pressable>
          </View>
        </View>

        {/* AI Inspection Findings Card */}
        {defectReason ? (
          <View className="mb-6 bg-zinc-50 dark:bg-[#16161A] p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
            <Text className="text-xs font-black text-[#FF2D55] uppercase tracking-wider mb-1.5">
              AI Defect Findings
            </Text>
            <Text className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              {defectReason}
            </Text>
          </View>
        ) : null}

        {/* Card 2: Complaint Details Form */}
        <View className="mb-8 bg-white dark:bg-[#111114] p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-base font-black text-black dark:text-white">
              2. Complaint Details
            </Text>
            {extracting && <ActivityIndicator size="small" color="#FF2D55" />}
          </View>

          {/* Brand Name */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Brand / Manufacturer
          </Text>
          <View className="flex-row items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 mb-3.5">
            <Building2 size={16} color="#FF2D55" style={{ marginRight: 10 }} />
            <TextInput
              value={brand}
              onChangeText={handleBrandChange}
              placeholder="e.g. boAt, Apple, Cadbury, Amazon..."
              placeholderTextColor="#71717A"
              className="flex-1 text-sm text-black dark:text-white font-semibold"
            />
          </View>

          {/* Product Name */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Product Name
          </Text>
          <View className="flex-row items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 mb-3.5">
            <Package size={16} color="#FF2D55" style={{ marginRight: 10 }} />
            <TextInput
              value={product}
              onChangeText={setProduct}
              placeholder="Auto-detecting product..."
              placeholderTextColor="#71717A"
              className="flex-1 text-sm text-black dark:text-white font-semibold"
            />
          </View>

          {/* Customer Care Email */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Customer Care Email
          </Text>
          <View className="flex-row items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 mb-3.5">
            <Mail size={16} color="#FF2D55" style={{ marginRight: 10 }} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. support@brand.com"
              placeholderTextColor="#71717A"
              keyboardType="email-address"
              autoCapitalize="none"
              className="flex-1 text-sm text-black dark:text-white font-semibold"
            />
          </View>

          {/* Helpline Phone Number */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Helpline Phone Number
          </Text>
          <View className="flex-row items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 mb-3.5">
            <Phone size={16} color="#FF2D55" style={{ marginRight: 10 }} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Toll-free / helpline phone number"
              placeholderTextColor="#71717A"
              keyboardType="phone-pad"
              className="flex-1 text-sm text-black dark:text-white font-semibold"
            />
            {phone && phone !== 'Not Found' ? (
              <Pressable
                onPress={handleCallSupport}
                className="bg-[#FF2D55]/10 px-3 py-1.5 rounded-lg border border-[#FF2D55]/30 active:opacity-80"
              >
                <Text className="text-xs font-bold text-[#FF2D55]">Call</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Order / Batch Number */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Order / Batch / Serial Number
          </Text>
          <View className="flex-row items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 mb-3.5">
            <Hash size={16} color="#FF2D55" style={{ marginRight: 10 }} />
            <TextInput
              value={orderNumber}
              onChangeText={setOrderNumber}
              placeholder="Auto-detected lot/order or enter manual #"
              placeholderTextColor="#71717A"
              className="flex-1 text-sm text-black dark:text-white font-semibold"
            />
          </View>

          {/* Customer Name */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Customer Name
          </Text>
          <View className="flex-row items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 mb-3.5">
            <User size={16} color="#FF2D55" style={{ marginRight: 10 }} />
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Your full name"
              placeholderTextColor="#71717A"
              className="flex-1 text-sm text-black dark:text-white font-semibold"
            />
          </View>

          {/* Issue Description */}
          <Text className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">
            Complaint Summary
          </Text>
          <View className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-3 mb-5">
            <TextInput
              value={issueDetails}
              onChangeText={setIssueDetails}
              multiline
              numberOfLines={4}
              placeholder="Drafted complaint details..."
              placeholderTextColor="#71717A"
              className="text-sm text-black dark:text-white leading-relaxed font-medium"
            />
          </View>

          {/* Action Buttons */}
          <View className="gap-3">
            <Pressable
              onPress={handleLaunchEmailDraft}
              disabled={draftingEmail || extracting}
              className={`bg-[#FF2D55] py-4 rounded-2xl flex-row justify-center items-center gap-2 shadow-lg shadow-[#FF2D55]/30 active:opacity-90 ${
                draftingEmail || extracting ? 'opacity-70' : ''
              }`}
            >
              {draftingEmail ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Mail size={18} color="#FFFFFF" />
              )}
              <Text className="text-white font-bold text-base">
                {draftingEmail ? 'Opening Mail...' : 'Draft Email'}
              </Text>
            </Pressable>

            {annotatedImageFilename ? (
              <Pressable
                onPress={handleShareProof}
                className="bg-zinc-50 dark:bg-zinc-900 py-3.5 rounded-2xl flex-row justify-center items-center gap-2 border border-zinc-200 dark:border-zinc-800 active:opacity-90"
              >
                <Share2 size={16} color="#FF2D55" />
                <Text className="text-black dark:text-white font-bold text-sm">
                  Share Defect Photo
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
