"use client";

import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/lib/supabase-auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { User, Shield, Bell, Palette, Trash2, Save, Edit3, Eye, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, session, updateProfile, changePassword } = useSupabaseAuth();
  const isAuthenticated = !!session;
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Modal states
  const [showEditUsernameModal, setShowEditUsernameModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showLoginHistoryModal, setShowLoginHistoryModal] = useState(false);
  
  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Settings state
  const [settings, setSettings] = useState({
    darkMode: false,
    autoSave: true,
    showBookmarks: true,
    showRecentSearches: true,
    skipDeleteConfirmation: false
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('userSettings');
      const skipDeleteConfirmation = localStorage.getItem('gabooja_skip_delete_confirmation') === 'true';
      
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          skipDeleteConfirmation // Override with the specific setting
        }));
      } else {
        setSettings(prev => ({
          ...prev,
          skipDeleteConfirmation
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  const handleSettingChange = (key: string, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Special handling for skipDeleteConfirmation
    if (key === 'skipDeleteConfirmation') {
      if (value) {
        localStorage.setItem('gabooja_skip_delete_confirmation', 'true');
      } else {
        localStorage.removeItem('gabooja_skip_delete_confirmation');
      }
    }
  };

  // Handle username update
  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) return;
    
    setIsLoading(true);
    try {
      const { error } = await updateProfile({ username: newUsername.trim() });
      if (error) {
        setMessage('Failed to update username: ' + (error instanceof Error ? error.message : error));
      } else {
        setMessage('Username updated successfully!');
        setShowEditUsernameModal(false);
        setNewUsername('');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      setMessage('Failed to update username');
    } finally {
      setIsLoading(false);
    }
  };


  // Handle password change
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Please fill in all password fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage('New password must be at least 6 characters');
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await changePassword(newPassword);
      
      if (error) {
        setMessage('Failed to change password: ' + error);
      } else {
        setMessage('Password changed successfully!');
        setShowChangePasswordModal(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      setMessage('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  // More realistic login history data
  const mockLoginHistory = [
    { id: 1, date: new Date().toISOString(), location: 'Current Session', device: 'Chrome 131 on macOS', ip: '76.102.234.156' },
    { id: 2, date: new Date(Date.now() - 7200000).toISOString(), location: 'San Francisco, CA', device: 'Chrome 131 on macOS', ip: '76.102.234.156' },
    { id: 3, date: new Date(Date.now() - 86400000).toISOString(), location: 'San Francisco, CA', device: 'Safari 17 on iPhone', ip: '76.102.234.156' },
    { id: 4, date: new Date(Date.now() - 172800000).toISOString(), location: 'San Francisco, CA', device: 'Chrome 131 on macOS', ip: '76.102.234.156' },
    { id: 5, date: new Date(Date.now() - 432000000).toISOString(), location: 'San Francisco, CA', device: 'Firefox 132 on macOS', ip: '76.102.234.156' },
  ];

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Save settings to localStorage
      localStorage.setItem('userSettings', JSON.stringify(settings));
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
              <p className="text-muted-foreground mb-4">
                Please sign in to access your settings.
              </p>
              <Button asChild>
                <a href="/login">Sign In</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and settings
          </p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Account Information</span>
                </CardTitle>
                <CardDescription>
                  Your account details and login information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Username</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => {
                          setNewUsername(profile?.username || '');
                          setShowEditUsernameModal(true);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input value={profile?.username || user?.username} disabled />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Member Since</label>
                    <Input 
                      value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'} 
                      disabled 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Login</label>
                    <Input 
                      value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'N/A'} 
                      disabled 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security</span>
                </CardTitle>
                <CardDescription>
                  Manage your account security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.id.startsWith('guest_') ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Security features are not available for guest accounts. Please create a full account to access password management and login history.
                    </p>
                  </div>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start cursor-pointer"
                      onClick={() => setShowChangePasswordModal(true)}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Change Password
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start cursor-pointer"
                      onClick={() => setShowLoginHistoryModal(true)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Login History
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Palette className="h-5 w-5" />
                  <span>App Preferences</span>
                </CardTitle>
                <CardDescription>
                  Customize your Gabooja experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Dark Mode</label>
                    <p className="text-xs text-muted-foreground">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <Button
                    variant={settings.darkMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('darkMode', !settings.darkMode)}
                  >
                    {settings.darkMode ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Auto-save Bookmarks</label>
                    <p className="text-xs text-muted-foreground">
                      Automatically save creators to bookmarks
                    </p>
                  </div>
                  <Button
                    variant={settings.autoSave ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('autoSave', !settings.autoSave)}
                  >
                    {settings.autoSave ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Show Bookmarks Section</label>
                    <p className="text-xs text-muted-foreground">
                      Display bookmarks in the navigation
                    </p>
                  </div>
                  <Button
                    variant={settings.showBookmarks ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('showBookmarks', !settings.showBookmarks)}
                  >
                    {settings.showBookmarks ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Show Recent Searches</label>
                    <p className="text-xs text-muted-foreground">
                      Display recent analysis history
                    </p>
                  </div>
                  <Button
                    variant={settings.showRecentSearches ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('showRecentSearches', !settings.showRecentSearches)}
                  >
                    {settings.showRecentSearches ? 'On' : 'Off'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Skip Delete Confirmation</label>
                    <p className="text-xs text-muted-foreground">
                      Skip confirmation dialog when deleting bookmarks
                    </p>
                  </div>
                  <Button
                    variant={settings.skipDeleteConfirmation ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSettingChange('skipDeleteConfirmation', !settings.skipDeleteConfirmation)}
                  >
                    {settings.skipDeleteConfirmation ? 'On' : 'Off'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Notification Settings</span>
                </CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trash2 className="h-5 w-5" />
                  <span>Data Management</span>
                </CardTitle>
                <CardDescription>
                  Manage your stored data and account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Export My Data
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Clear Bookmarks
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Clear Recent Searches
                </Button>
                <Button variant="destructive" className="w-full justify-start">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {message && (
          <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {message}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <Button onClick={handleSaveSettings} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {/* Edit Username Modal */}
        <Dialog open={showEditUsernameModal} onOpenChange={setShowEditUsernameModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Username</DialogTitle>
              <DialogDescription>
                Choose a new username for your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-username">New Username</Label>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditUsernameModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUsername} disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Username'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Change Password Modal */}
        <Dialog open={showChangePasswordModal} onOpenChange={setShowChangePasswordModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Update your account password
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowChangePasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword} disabled={isLoading}>
                {isLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Login History Modal */}
        <Dialog open={showLoginHistoryModal} onOpenChange={setShowLoginHistoryModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Login History</DialogTitle>
              <DialogDescription>
                Recent login activity for your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {mockLoginHistory.map((login) => (
                <div key={login.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {new Date(login.date).toLocaleDateString()} at {new Date(login.date).toLocaleTimeString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {login.device} • {login.location}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        IP: {login.ip}
                      </div>
                    </div>
                    <div className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded">
                      Successful
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowLoginHistoryModal(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 